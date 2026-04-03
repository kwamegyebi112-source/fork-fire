export default function manifest() {
  return {
    name: "Fork N' Fire",
    short_name: "Fork N Fire",
    description: "Sales and expense tracker for Fork N' Fire.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f8f2ed",
    theme_color: "#fffdfb",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
