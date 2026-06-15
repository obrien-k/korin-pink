// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'korin.pink',
  tagline: 'IRC community wiki for Stellar',
  favicon: 'img/favicon.ico',
  markdown: {
    mermaid: true,
  },
  url: 'https://korin.pink',
  baseUrl: '/wiki/',

  organizationName: 'obrien-k',
  projectName: 'korin-pink',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/obrien-k/korin-pink/tree/main/wiki/',
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/social-card.jpg',
      navbar: {
        title: 'korin.pink',
        logo: {
          alt: 'korin.pink logo',
          src: 'img/logo.png',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'ircSidebar',
            position: 'left',
            label: 'IRC',
          },
          {
            type: 'docSidebar',
            sidebarId: 'archiveSidebar',
            position: 'left',
            label: 'Archive',
          },
          {
            href: 'https://github.com/obrien-k/korin-pink',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'IRC',
            items: [
              { label: 'Connecting', to: '/irc/connecting' },
              { label: 'Channels', to: '/irc/channels' },
              { label: 'IRCScore', to: '/irc/irc-score' },
            ],
          },
          {
            title: 'Community',
            items: [
              { label: 'Stellar (orphic-inc)', href: 'https://github.com/orphic-inc/stellar-api' },
              { label: 'korin-pink (source)', href: 'https://github.com/obrien-k/korin-pink' },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Orphic, INC. Built with Docusaurus.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;
