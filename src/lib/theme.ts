import { createTheme, rem, MantineColorsTuple } from "@mantine/core";

// Academic Sanctuary Color Palette
const sanctuary: MantineColorsTuple = [
  "#F9F7F4", // 0 - Background (warm off-white, aged paper)
  "#F2F0ED", // 1 - Surface (soft beige, library shelves)
  "#E8E6E3", // 2 - Border light
  "#D9CBA0", // 3 - Border medium
  "#C2B280", // 4 - Divider
  "#8B5B29", // 5 - Secondary action (warm brown, books)
  "#6B6B6B", // 6 - Text secondary (warm gray)
  "#4A4A4A", // 7 - Text medium
  "#2C2A29", // 8 - Text primary (charcoal)
  "#1A1918", // 9 - Text darkest
];

const forestGreen: MantineColorsTuple = [
  "#F3F8F0", // 0 - Very light
  "#E6F2E0", // 1 - Light
  "#CEE6C1", // 2 - Light medium
  "#A3C6A0", // 3 - Success green (soft sage)
  "#7FA67A", // 4 - Medium
  "#5B8655", // 5 - Medium dark
  "#4A7C2A", // 6 - Primary action (forest green)
  "#3D6622", // 7 - Dark
  "#2F4F1A", // 8 - Very dark
  "#213912", // 9 - Darkest
];

const warmAccents: MantineColorsTuple = [
  "#FAF7F2", // 0 - Very light sand
  "#F5EFE6", // 1 - Light sand  
  "#EDE2D1", // 2 - Medium light
  "#D9B68D", // 3 - Warning (warm sand)
  "#C2856B", // 4 - Error (muted terracotta)
  "#A67C5A", // 5 - Medium brown
  "#8B5B29", // 6 - Secondary brown
  "#704A21", // 7 - Dark brown
  "#553919", // 8 - Very dark brown
  "#3A2811", // 9 - Darkest brown
];

export const theme = createTheme({
  // Primary color for main actions (forest green)
  primaryColor: "forestGreen",
  
  colors: {
    sanctuary,
    forestGreen,
    warmAccents,
  },


  // Academic-focused spacing for comfortable reading
  spacing: {
    xs: rem(8),
    sm: rem(12),
    md: rem(20), // Increased for better breathing room
    lg: rem(32),
    xl: rem(48),
  },

  // Typography optimized for academic reading
  fontSizes: {
    xs: rem(12),
    sm: rem(14),
    md: rem(16),
    lg: rem(18),
    xl: rem(24), // Larger for better hierarchy
  },

  lineHeights: {
    xs: "1.4",
    sm: "1.5",
    md: "1.6", // Optimal for reading
    lg: "1.7",
    xl: "1.3", // Tighter for headings
  },

  // Responsive breakpoints
  breakpoints: {
    xs: "30em", // 480px
    sm: "48em", // 768px
    md: "64em", // 1024px
    lg: "80em", // 1280px
    xl: "96em", // 1536px
  },

  // Academic Sanctuary component styling
  components: {
    Button: {
      defaultProps: {
        size: "md",
        radius: "sm",
      },
      styles: {
        root: {
          fontWeight: 500,
          borderWidth: '1px',
        },
      },
    },
    
    Card: {
      defaultProps: {
        radius: "md",
        shadow: "xs",
        withBorder: false,
        bg: "white",
      },
      styles: {
        root: {
          border: `1px solid ${sanctuary[2]}`,
          backgroundColor: '#FFFFFF',
        },
      },
    },
    
    Container: {
      defaultProps: {
        size: "lg",
      },
    },
    
    Paper: {
      defaultProps: {
        radius: "md",
        shadow: "xs",
        bg: "sanctuary.1",
      },
      styles: {
        root: {
          border: `1px solid ${sanctuary[2]}`,
        },
      },
    },
    
    TextInput: {
      defaultProps: {
        size: "md",
        radius: "sm",
      },
      styles: {
        input: {
          backgroundColor: '#FFFFFF',
          border: `1px solid ${sanctuary[3]}`,
          '&:focus': {
            borderColor: forestGreen[6],
          },
        },
      },
    },

    Title: {
      styles: {
        root: {
          color: sanctuary[8],
          fontWeight: 600,
        },
      },
    },

    Text: {
      styles: {
        root: {
          color: sanctuary[8],
          lineHeight: 1.6,
        },
      },
    },

    ActionIcon: {
      styles: {
        root: {
          border: `1px solid ${sanctuary[2]}`,
        },
      },
    },

    Badge: {
      defaultProps: {
        radius: "sm",
      },
      styles: {
        root: {
          fontWeight: 500,
        },
      },
    },
  },

  // Subtle, library-inspired shadows
  shadows: {
    xs: "0 1px 3px rgba(44, 42, 41, 0.08)",
    sm: "0 2px 6px rgba(44, 42, 41, 0.10)",
    md: "0 4px 12px rgba(44, 42, 41, 0.12)",
    lg: "0 8px 24px rgba(44, 42, 41, 0.14)",
    xl: "0 16px 48px rgba(44, 42, 41, 0.16)",
  },

  // Consistent radius for the sanctuary aesthetic
  radius: {
    xs: rem(3),
    sm: rem(6),
    md: rem(8),
    lg: rem(12),
    xl: rem(20),
  },

  // Academic-focused contrast and accessibility
  autoContrast: true,
  luminanceThreshold: 0.25,
});