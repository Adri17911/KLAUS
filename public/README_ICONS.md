# App Icons Setup

## Required Icons

For the PWA to work properly, you need to create two icon files:

1. `icon-192.png` - 192x192 pixels
2. `icon-512.png` - 512x512 pixels

## Quick Setup Options

### Option 1: Use Online Generator
1. Go to https://realfavicongenerator.net/ or https://www.pwabuilder.com/imageGenerator
2. Upload your logo/icon
3. Download the generated icons
4. Place them in the `public/` directory

### Option 2: Create Manually
1. Create a square image (at least 512x512)
2. Export as PNG:
   - 192x192 version → `icon-192.png`
   - 512x512 version → `icon-512.png`
3. Place both files in the `public/` directory

### Option 3: Use Placeholder (Development)
For development, you can use any square image. The app will work without proper icons, but they're recommended for production.

## Icon Guidelines

- **Format**: PNG with transparency
- **Shape**: Square (1:1 aspect ratio)
- **Content**: Should work well at small sizes
- **Background**: Transparent or solid color
- **Style**: Simple, recognizable design

## Testing

After adding icons:
1. Clear browser cache
2. Reload the app
3. Check if icons appear in:
   - Browser tab
   - Home screen (when installed)
   - App switcher



