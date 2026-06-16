export interface FirewallConfig {
  /** CIDR allowed to reach SSH (e.g. your admin IP). */
  sshAllowCidr: string;
  /** Gate the IRC ports closed until Ergo is actually live. */
  ircEnabled: boolean;
  /** Container-published IRC ports (TLS, WebSocket, plain). */
  ircPorts: number[];
  /** hashlimit: max NEW connections per minute per source IP. */
  newConnsPerMinPerIp: number;
  /** connlimit: max concurrent connections per source IP. */
  maxConcurrentPerIp: number;
  /** Public NIC the box egresses on (Vultr Ubuntu = eth0). Default 'eth0'. */
  publicIface?: string;
  /** Inbound web ports the front-door Caddy publishes. Default [80, 443]. */
  webPorts?: number[];
}

/** Vultr Ubuntu images bring the box up on eth0. */
const DEFAULT_PUBLIC_IFACE = 'eth0';
/** Caddy fronts the public API on 80/443 (+ 443/udp for HTTP/3). */
const DEFAULT_WEB_PORTS = [80, 443];

/**
 * The always-applied head of the DOCKER-USER chain — NOT gated by IRC.
 *
 * The chain ends in a blanket DROP (published ports bypass ufw), and DOCKER-USER
 * governs ALL forwarded traffic, so without these the perimeter also strangles
 * the web stack: container egress (Caddy → Let's Encrypt, api → stellar-api,
 * image pulls) and inbound 80/443 to Caddy would be dropped. These run whether or
 * not Ergo is live, because the API box needs them regardless.
 */
export function buildBaseAllowRules(
  cfg: { publicIface?: string; webPorts?: number[] } = {},
): string[] {
  const iface = cfg.publicIface ?? DEFAULT_PUBLIC_IFACE;
  const webPorts = cfg.webPorts ?? DEFAULT_WEB_PORTS;
  const rules: string[] = [];
  // Return traffic must skip the limits and the default drop. Must be first.
  rules.push('iptables -A DOCKER-USER -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN');
  // Container EGRESS: new connections leaving via the public NIC (LE, stellar,
  // npm/image pulls). Ingress stays restricted by the rules below + the drop.
  rules.push(
    `iptables -A DOCKER-USER -o ${iface} -m conntrack --ctstate NEW -j RETURN`,
  );
  // Inbound web → Caddy. Published ports bypass ufw, so allow them here.
  rules.push(
    `iptables -A DOCKER-USER -i ${iface} -p tcp -m multiport --dports ${webPorts.join(',')} -j RETURN`,
  );
  // HTTP/3 rides UDP 443; multiport above is TCP-only.
  if (webPorts.includes(443)) {
    rules.push(`iptables -A DOCKER-USER -i ${iface} -p udp --dport 443 -j RETURN`);
  }
  return rules;
}

/**
 * Emit the iptables DOCKER-USER ruleset that filters Docker-published ports.
 * Docker-published ports bypass ufw, so this chain is the real perimeter.
 */
/** Per-IRC-port rules: drop above the rate, drop above concurrency, else accept. */
export function buildIrcPortRules(
  ports: number[],
  opts: { newConnsPerMinPerIp: number; maxConcurrentPerIp: number },
): string[] {
  const rules: string[] = [];
  for (const port of ports) {
    // Drop NEW connections from a source IP above the per-minute rate.
    rules.push(
      `iptables -A DOCKER-USER -p tcp --dport ${port} -m conntrack --ctstate NEW ` +
        `-m hashlimit --hashlimit-name irc${port} --hashlimit-mode srcip ` +
        `--hashlimit-above ${opts.newConnsPerMinPerIp}/min ` +
        `--hashlimit-burst ${opts.newConnsPerMinPerIp} -j DROP`,
    );
    // Drop once a single source IP holds too many concurrent connections.
    rules.push(
      `iptables -A DOCKER-USER -p tcp --dport ${port} ` +
        `-m connlimit --connlimit-above ${opts.maxConcurrentPerIp} --connlimit-mask 32 -j DROP`,
    );
    // Conforming traffic (under both limits) is accepted — must come last.
    rules.push(`iptables -A DOCKER-USER -p tcp --dport ${port} -j RETURN`);
  }
  return rules;
}

export function buildFirewallRules(cfg: FirewallConfig): string[] {
  // Established RETURN + container egress + inbound web (always on).
  const rules: string[] = buildBaseAllowRules(cfg);
  if (cfg.ircEnabled) {
    rules.push(
      ...buildIrcPortRules(cfg.ircPorts, {
        newConnsPerMinPerIp: cfg.newConnsPerMinPerIp,
        maxConcurrentPerIp: cfg.maxConcurrentPerIp,
      }),
    );
  }
  // Anything not explicitly allowed above is dropped.
  rules.push('iptables -A DOCKER-USER -j DROP');
  return rules;
}
