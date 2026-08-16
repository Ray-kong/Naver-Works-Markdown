export const PREVIEW_STYLES = `
:host { contain:inline-size; display:block; box-sizing:border-box; min-width:0; width:var(--wmp-host-width,100%); max-width:100%; margin-left:var(--wmp-host-offset,0); padding-top:8px; color:inherit; font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
.preview-root { align-items:flex-start; display:flex; flex-direction:column; min-width:0; width:100%; }
:host([data-wmp-side="right"]) .preview-root { align-items:flex-end; }
button { appearance:none; border:1px solid color-mix(in srgb,currentColor 28%,transparent); border-radius:6px; background:color-mix(in srgb,currentColor 5%,transparent); color:inherit; cursor:pointer; font:600 12px/1.2 inherit; padding:5px 9px; }
button:hover { background:color-mix(in srgb,currentColor 10%,transparent); }
button:disabled { cursor:not-allowed; opacity:.62; }
button:focus-visible { outline:2px solid #2563eb; outline-offset:2px; }
.panel { box-sizing:border-box; flex:none; margin-top:7px; width:min(720px,calc(100vw - 96px)); max-height:min(720px,70vh); border:1px solid color-mix(in srgb,currentColor 20%,transparent); border-radius:8px; background:color-mix(in srgb,currentColor 3%,transparent); padding:12px 14px; overflow:auto; text-align:left; }
.panel[hidden] { display:none; }
.document + .document { border-top:1px solid color-mix(in srgb,currentColor 20%,transparent); margin-top:14px; padding-top:14px; }
.filename { color:inherit; font-size:12px; font-weight:600; margin:0 0 8px; opacity:.78; }
.loading,.error { color:inherit; margin:0; opacity:.78; }
.error { color:#d92d20; opacity:1; }
h1,h2,h3,h4,h5,h6 { line-height:1.3; margin:1em 0 .45em; }
h1:first-child,h2:first-child,h3:first-child,p:first-child { margin-top:0; }
p:last-child,pre:last-child,ul:last-child,ol:last-child { margin-bottom:0; }
pre { background:color-mix(in srgb,currentColor 7%,transparent); border-radius:6px; overflow:auto; padding:10px 12px; }
code { font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:.92em; }
:not(pre)>code { background:color-mix(in srgb,currentColor 7%,transparent); border-radius:3px; padding:1px 4px; }
blockquote { border-left:3px solid color-mix(in srgb,currentColor 35%,transparent); color:inherit; margin-left:0; padding-left:12px; opacity:.85; }
table { border-collapse:collapse; max-width:100%; }
th,td { border:1px solid color-mix(in srgb,currentColor 25%,transparent); padding:5px 8px; text-align:left; }
a { color:inherit; text-decoration:underline; }
.mermaid-diagram { background:#fff; border-radius:6px; color:#111; margin:12px 0; overflow:auto; padding:8px; }
.mermaid-diagram svg { display:block; height:auto; max-width:100%; }
`;
