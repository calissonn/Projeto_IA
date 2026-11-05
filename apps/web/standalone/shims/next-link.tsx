import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { navigate } from '../router';

/** Substituto de next/link para a versão standalone. */
export default function Link({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) {
  return (
    <a
      {...rest}
      href={href === '/' ? '#predio' : '#central'}
      onClick={(e) => {
        e.preventDefault();
        navigate(href);
      }}
    >
      {children}
    </a>
  );
}
