import { useEffect } from 'react';

import Artifact from './Artifact.jsx';

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

const formatDate = (iso) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export default function TokenDetail({ mint, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div className="detail" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={mint.name}>
        <button className="close" onClick={onClose} type="button" aria-label="Close">
          ×
        </button>

        <div className="detail-stage">
          <Artifact mint={mint} />
        </div>

        <div className="detail-info">
          <h2>{mint.name}</h2>

          <p className="detail-artists">
            {mint.creators.map((c) => (
              <a
                key={c.address}
                href={`https://objkt.com/users/${c.address}`}
                target="_blank"
                rel="noreferrer"
              >
                {c.alias || c.address}
              </a>
            ))}
          </p>

          {mint.description && <p className="detail-description">{mint.description}</p>}

          <dl>
            <dt>Platform</dt>
            <dd>
              {mint.platformUrl ? (
                <a href={mint.platformUrl} target="_blank" rel="noreferrer">
                  {mint.platform}
                </a>
              ) : (
                mint.platform
              )}
              {mint.contractVersion && ` (${mint.contractVersion})`}
            </dd>

            {mint.collection && (
              <>
                <dt>Collection</dt>
                <dd>{mint.collection}</dd>
              </>
            )}

            <dt>Minted</dt>
            <dd>{formatDate(mint.mintedAt)}</dd>

            <dt>Editions</dt>
            <dd>{mint.supply}</dd>

            <dt>On-chain size</dt>
            <dd>
              {kb(mint.bytes)} · {mint.mime}
            </dd>

            <dt>Token</dt>
            <dd>
              <a
                href={`https://objkt.com/tokens/${mint.contract}/${mint.tokenId}`}
                target="_blank"
                rel="noreferrer"
              >
                objkt
              </a>
              {' · '}
              <a href={`https://tzkt.io/${mint.contract}/tokens`} target="_blank" rel="noreferrer">
                tzkt
              </a>
              {' · '}
              <a href={`${import.meta.env.BASE_URL}mints/${mint.file}`} target="_blank" rel="noreferrer">
                raw
              </a>
            </dd>
          </dl>
        </div>
      </div>
    </div>
  );
}
