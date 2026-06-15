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
}

/**
 * Emit the iptables DOCKER-USER ruleset that filters Docker-published ports.
 * Docker-published ports bypass ufw, so this chain is the real perimeter.
 */
export function buildFirewallRules(cfg: FirewallConfig): string[] {
  const rules: string[] = [];
  // Return traffic must skip the limits and the default drop.
  rules.push('iptables -A DOCKER-USER -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN');
  if (cfg.ircEnabled) {
    for (const port of cfg.ircPorts) {
      // Drop NEW connections from a source IP above the per-minute rate.
      rules.push(
        `iptables -A DOCKER-USER -p tcp --dport ${port} -m conntrack --ctstate NEW ` +
          `-m hashlimit --hashlimit-name irc${port} --hashlimit-mode srcip ` +
          `--hashlimit-above ${cfg.newConnsPerMinPerIp}/min ` +
          `--hashlimit-burst ${cfg.newConnsPerMinPerIp} -j DROP`,
      );
      // Drop once a single source IP holds too many concurrent connections.
      rules.push(
        `iptables -A DOCKER-USER -p tcp --dport ${port} ` +
          `-m connlimit --connlimit-above ${cfg.maxConcurrentPerIp} --connlimit-mask 32 -j DROP`,
      );
      // Conforming traffic (under both limits) is accepted — must come last so
      // the limit drops above take precedence.
      rules.push(`iptables -A DOCKER-USER -p tcp --dport ${port} -j RETURN`);
    }
  }
  // Anything not explicitly allowed above is dropped.
  rules.push('iptables -A DOCKER-USER -j DROP');
  return rules;
}
