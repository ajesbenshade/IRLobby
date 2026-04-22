import { useEffect } from 'react';

type PublicMetadataProps = {
  title: string;
  description: string;
  canonicalPath?: string;
};

const DEFAULT_OG_IMAGE = 'https://irlobby.app/og-default.png';

function upsertMetaByName(name: string, content: string) {
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function upsertMetaByProperty(property: string, content: string) {
  let tag = document.querySelector(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function upsertCanonical(url: string) {
  let tag = document.querySelector('link[rel="canonical"]');
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', 'canonical');
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', url);
}

export default function PublicMetadata({ title, description, canonicalPath = '/' }: PublicMetadataProps) {
  useEffect(() => {
    const canonicalUrl = new URL(canonicalPath, window.location.origin).toString();

    document.title = title;
    upsertMetaByName('description', description);
    upsertMetaByName('twitter:title', title);
    upsertMetaByName('twitter:description', description);
    upsertMetaByProperty('og:title', title);
    upsertMetaByProperty('og:description', description);
    upsertMetaByProperty('og:url', canonicalUrl);
    upsertMetaByProperty('og:image', DEFAULT_OG_IMAGE);
    upsertCanonical(canonicalUrl);
  }, [canonicalPath, description, title]);

  return null;
}
