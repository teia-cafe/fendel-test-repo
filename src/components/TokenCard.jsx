import { useEffect, useRef, useState } from 'react';

import Artifact from './Artifact.jsx';

/* A grid tile. Artifacts are mounted only while on screen: each framed piece
 * runs its own scripts, so keeping all of them alive would burn CPU. */
export default function TokenCard({ mint, onOpen }) {
  const ref = useRef(null);
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { rootMargin: '400px' },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const artist = mint.creators[0];

  return (
    <button ref={ref} className="card" onClick={() => onOpen(mint)} type="button">
      <span className="card-frame">{onScreen && <Artifact mint={mint} />}</span>
      <span className="card-meta">
        <span className="card-name">{mint.name}</span>
        <span className="card-artist">{artist?.alias || artist?.address.slice(0, 10) || 'unknown'}</span>
        <span className="card-platform">{mint.platform}</span>
      </span>
    </button>
  );
}
