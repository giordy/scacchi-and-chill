declare module '*.svg?raw' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const url: string;
  export default url;
}
