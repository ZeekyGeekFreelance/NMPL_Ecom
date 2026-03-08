// Generate a placeholder image URL with random background color and text
export const generatePlaceholderImage = (
  text: string,
  size: number = 200
): string => {
  // Extract first letter of each word for initials
  const initials = text
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);

  // Random background colors aligned to the app palette
  const colors = [
    "#1d3461", // Primary
    "#152847", // Primary hover
    "#b84c0d", // Secondary
    "#15803d", // Success
    "#b45309", // Warning
    "#b91c1c", // Error
    "#1f2937", // Dark mid
    "#4b5563", // Text muted
  ];

  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  // Create a simple SVG placeholder
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${randomColor}"/>
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${
        size * 0.3
      }" 
            fill="white" text-anchor="middle" dy="0.35em" font-weight="bold">
        ${initials}
      </text>
    </svg>
  `;

  // Convert SVG to data URL
  const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
  return dataUrl;
};

// Generate a placeholder image for products
export const generateProductPlaceholder = (productName: string): string => {
  return generatePlaceholderImage(productName, 400);
};

// Generate a placeholder avatar for users
export const generateUserAvatar = (userName: string): string => {
  return generatePlaceholderImage(userName, 200);
};
