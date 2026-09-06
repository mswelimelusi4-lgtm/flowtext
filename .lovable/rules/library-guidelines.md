# Connect & Share — Guidelines

## Components

The design system exports these components — import them from `@ws-5ng1b8pm60prtauixpfz/edfc0a99-a53b-46b6-b532-e7d88ec55b3a` and compose them before building anything from scratch:

`AppShell`, `ChatPanel`, `Composer`, `Constants`, `EmptyNote`, `GroupInfoPanel`, `InboxPanel`, `MediaLightbox`, `NotificationsList`, `OnScreenKeyboard`, `PostCard`, `RailCard`, `SignUpFlow`, `StoriesTray`, `StoryComposer`, `StoryViewer`, `UserAvatar`, `Wordmark`

Per-component details (import stanzas, props, variants, examples) live in `.lovable/rules/libraries/{slug}/components.md` — on disk, not auto-loaded. Read that file or the component source when the name alone isn't enough.

## Theme Files

The design system's theme is delivered through the following files. The author's original source files carry the full wiring the design system needs — variable declarations, framework-specific directives, provider objects, etc. — and are the canonical import target.

- `@ws-5ng1b8pm60prtauixpfz/edfc0a99-a53b-46b6-b532-e7d88ec55b3a/styles.css` (source — preferred import)
- `@ws-5ng1b8pm60prtauixpfz/edfc0a99-a53b-46b6-b532-e7d88ec55b3a/dist/tokens.css` (auto-generated flat list of CSS custom properties — a raw-values fallback only; does NOT carry framework-specific wiring that the source files above provide)

