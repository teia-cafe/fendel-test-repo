/* Renders one on-chain artifact as an image, always.
 *
 * Artifacts are arbitrary code written by strangers. Chrome will only execute
 * script inside an SVG document when the frame carries `allow-same-origin`, and
 * since these files are served from the gallery's own origin, granting that
 * would let any minted artwork script this page. On a site for a crypto
 * audience that is a phishing vector, so nothing here is ever framed.
 *
 * Generative pieces are screenshotted at build time instead (see
 * scripts/fetch-mints.mjs) and served as the resulting still.
 */

const base = import.meta.env.BASE_URL;

export default function Artifact({ mint }) {
  const file = mint.thumb ?? mint.file;

  return (
    <img
      className="artifact"
      src={`${base}mints/${file}`}
      alt={mint.name}
      loading="lazy"
      // Vector sources are crisp at any size; rendered stills are not scaled up.
      style={mint.thumb ? { imageRendering: 'auto' } : undefined}
    />
  );
}
