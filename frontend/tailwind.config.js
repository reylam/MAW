/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'maw-bg': 'var(--maw-bg)',
        'maw-surface': 'var(--maw-surface)',
        'maw-card': 'var(--maw-card)',
        'maw-hover': 'var(--maw-hover)',
        'maw-border': 'var(--maw-border)',
        'maw-border-strong': 'var(--maw-border-strong)',
        'maw-border-subtle': 'var(--maw-border-subtle)',

        'maw-primary': 'var(--maw-primary)',
        'maw-primary-hover': 'var(--maw-primary-hover)',
        'maw-primary-soft': 'var(--maw-primary-soft)',
        'maw-accent': 'var(--maw-accent)',
        'maw-accent-hover': 'var(--maw-accent-hover)',
        'maw-accent-soft': 'var(--maw-accent-soft)',
        'maw-accent-border': 'var(--maw-accent-border)',

        'maw-safe': 'var(--maw-safe)',
        'maw-safe-soft': 'var(--maw-safe-soft)',
        'maw-safe-border': 'var(--maw-safe-border)',
        'maw-warning': 'var(--maw-warning)',
        'maw-warning-soft': 'var(--maw-warning-soft)',
        'maw-warning-border': 'var(--maw-warning-border)',
        'maw-critical': 'var(--maw-critical)',
        'maw-critical-soft': 'var(--maw-critical-soft)',
        'maw-critical-border': 'var(--maw-critical-border)',
        'maw-offline': 'var(--maw-offline)',
        'maw-offline-soft': 'var(--maw-offline-soft)',
        'maw-offline-border': 'var(--maw-offline-border)',

        'maw-text-main': 'var(--maw-text-main)',
        'maw-text-muted': 'var(--maw-text-muted)',
        'maw-text-subtle': 'var(--maw-text-subtle)',
      },
      borderRadius: {
        'maw-sm': 'var(--maw-radius-sm)',
        'maw': 'var(--maw-radius)',
        'maw-lg': 'var(--maw-radius-lg)',
      },
      boxShadow: {
        'maw-sm': 'var(--maw-shadow-sm)',
        'maw': 'var(--maw-shadow)',
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        sans: ['IBM Plex Sans', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
