// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'korin.wiki',
  tagline: '光琳.ウィキ',
  favicon: 'img/favicon.ico',
  markdown: {
    mermaid: true,
  },
  // Set the production url of your site here
  url: 'https://korin.wiki',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'obrien-k', // Usually your GitHub org/user name.
  projectName: 'korin-omnibus', // Usually your repo name.

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
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
          editUrl:
            'https://github.com/obrien-k/korin-omnibus/tree/main/packages/create-docusaurus/templates/shared/',
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
      themes: ['@docusaurus/theme-mermaid'],
      image: 'img/social-card.jpg',
      navbar: {
        title: 'korin.wiki',
        logo: {
          alt: 'korin.wiki Logo',
          src: 'img/logo.png',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'wikiSidebar',
            position: 'left',
            label: 'Wiki',
          },
          {to: 'https://kyleo.io', label: 'Blog', position: 'left'},
          {
            href: 'https://github.com/obrien-k/korin-omnibus',
            label: 'Omnibus GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'light',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Wiki',
                to: '/docs/intro',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'Stack Overflow',
                href: 'https://stackoverflow.com/users/9281567/kyle-obrien',
              },
              {
                label: 'Discord',
                href: 'https://discord.gg/uqTtncNpnJ',
              },
              {
                label: 'Twitter',
                href: 'https://twitter.com/kyle_o',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'Blog',
                to: 'https://kyleo.io',
              },
              {
                label: 'Omnibus GitHub',
                href: 'https://github.com/obrien-k/korin-omnibus',
              },
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
