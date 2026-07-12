// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const OG_IMAGE = 'https://korin.pink/wiki/social-card.jpg';

// https://astro.build/config
export default defineConfig({
  site: 'https://korin.pink',
  // No `base`: the landing page owns `/` (src/pages/index.astro) while the
  // Starlight docs live under src/content/docs/wiki/** so they serve at /wiki/*.
  integrations: [
    starlight({
      // Site name → the right-hand half of every page's <title> ("… | wiki") and
      // the header label beside the korin.pink logo. The wiki home page (entry
      // title "korin.pink") therefore reads "korin.pink | wiki".
      title: 'wiki',
      tagline: 'IRC community wiki for Stellar',
      logo: { src: './src/assets/logo.png', alt: 'korin.pink logo' },
      favicon: '/favicon.ico',
      customCss: ['./src/styles/custom.css'],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/obrien-k/korin-pink' },
      ],
      // Starlight appends the entry path (e.g. wiki/irc/connecting.md) to this base.
      editLink: {
        baseUrl: 'https://github.com/obrien-k/korin-pink/tree/main/packages/web/src/content/docs/',
      },
      // Replaces the old Docusaurus themeConfig.image social card.
      head: [
        { tag: 'meta', attrs: { property: 'og:image', content: OG_IMAGE } },
        { tag: 'meta', attrs: { name: 'twitter:image', content: OG_IMAGE } },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
      ],
      sidebar: [
        { label: 'Home', slug: 'wiki' },
        {
          label: 'IRC',
          collapsed: false,
          items: [
            { label: 'Overview', slug: 'wiki/irc' },
            { label: 'Connecting', slug: 'wiki/irc/connecting' },
            { label: 'Channels', slug: 'wiki/irc/channels' },
            { label: 'Etiquette', slug: 'wiki/irc/etiquette' },
            { label: 'IRCScore', slug: 'wiki/irc/irc-score' },
          ],
        },
        {
          label: 'Code Noobs',
          collapsed: false,
          items: [
            { label: 'Code Noobs Root', slug: 'wiki/code-noobs-archive' },
            { slug: 'wiki/code-noobs-archive/introduction-to-programming' },
            { slug: 'wiki/code-noobs-archive/introduction-to-dom' },
            { slug: 'wiki/code-noobs-archive/functions' },
            { slug: 'wiki/code-noobs-archive/promises' },
            { slug: 'wiki/code-noobs-archive/app-project' },
            { slug: 'wiki/code-noobs-archive/whisklist-proof-of-concept' },
            { slug: 'wiki/code-noobs-archive/building-a-pc' },
            { slug: 'wiki/code-noobs-archive/linux-free-open-source-software-101' },
            { slug: 'wiki/code-noobs-archive/stencil-cli-and-postman' },
            { slug: 'wiki/code-noobs-archive/2018-year-in-review' },
          ],
        },
        {
          label: 'Audio & Gear',
          items: [
            { slug: 'wiki/audiophile' },
            { slug: 'wiki/stereo-setup' },
            { slug: 'wiki/sapphire-zen-build' },
          ],
        },
        {
          label: 'Enthusiast',
          items: [
            { slug: 'wiki/cinephile' },
            { slug: 'wiki/ejuice-supplies-and-tips' },
          ],
        },
        {
          label: 'Operating Systems',
          items: [{ autogenerate: { directory: 'wiki/operating-system' } }],
        },
        {
          label: 'Blog Posts',
          items: [{ autogenerate: { directory: 'wiki/blog-posts' } }],
        },
        {
          label: 'Streaming',
          items: [
            { slug: 'wiki/strem' },
            { slug: 'wiki/strem/vod-prod' },
          ],
        },
        {
          label: 'Japanese',
          items: [
            { slug: 'wiki/jp' },
            { slug: 'wiki/jp/godai' },
          ],
        },
        {
          label: 'Lineage (legacy)',
          items: [
            { slug: 'wiki/creating-a-secure-password' },
            { slug: 'wiki/misc/contributor-program' },
            { slug: 'wiki/privacy-policy' },
            { slug: 'wiki/misc/gitlab-public-docs' },
            { slug: 'wiki/misc/digital-nomad-integration' },
          ],
        },
        {
          label: 'Misc',
          items: [{ autogenerate: { directory: 'wiki/misc' } }],
        },
      ],
    }),
  ],
});
