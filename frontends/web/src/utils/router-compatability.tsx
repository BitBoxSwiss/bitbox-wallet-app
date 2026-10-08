import { useEffect, type ReactNode, useSyncExternalStore, useMemo, useCallback } from 'react';
import {
  type BaseLocationHook,
  Link,
  Switch,
  useLocation as useLocationWouter,
} from 'wouter';

export const useNavigate = () => {
  const [, navigate] = useLocationWouter();
  return navigate;
};

type TNavigateProps = {
  to: string;
  replace?: boolean;
  state?: unknown;
};

export const Navigate = ({
  to,
  replace = false,
  state,
}: TNavigateProps): null => {
  const [, navigate] = useLocationWouter();

  useEffect(() => {
    navigate(to, {
      replace,
      ...(state !== undefined ? { state } : {}),
    });
  }, [navigate, to, replace, state]);

  return null;
};

type TRoutesProps = {
  children?: ReactNode;
};

export const Routes = ({ children }: TRoutesProps) => {
  return (
    <Switch>
      {children}
    </Switch>
  );
};

type NavLinkProps = {
  to: string;
  className?:
    | string
    | ((props: { isActive: boolean }) => string);
  children?: ReactNode;
} & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'href' | 'className'
>;

export const NavLink = ({
  to,
  className,
  children,
  ...props
}: NavLinkProps) => {
  const [location] = useLocationWouter();

  const isActive = (

    location === to ||
    location.startsWith(`${to}/`)
  );

  const resolvedClassName = (

    typeof className === 'function'
      ? className({ isActive })
      : className
  );

  return (
    <Link
      href={to}
      className={resolvedClassName}
      {...props}
    >
      {children}
    </Link>
  );
};

const getHashLocation = () => {
  const hash = window.location.hash.slice(1) || '/';
  const queryIndex = hash.indexOf('?');

  return queryIndex === -1
    ? hash
    : hash.slice(0, queryIndex);
};

const subscribe = (callback: () => void) => {
  window.addEventListener('hashchange', callback);

  return () => {
    window.removeEventListener('hashchange', callback);
  };
};

type THashNavigation = {
  hash: string;
  type: 'POP' | 'PUSH' | 'REPLACE';
};

const initialHashNavigation: THashNavigation = { hash: '', type: 'POP' };
let hashNavigation = initialHashNavigation;

const getHashNavigation = (): THashNavigation => {
  // Changes outside navigate() come from browser history or direct hash navigation.
  if (hashNavigation.hash !== window.location.hash) {
    hashNavigation = { hash: window.location.hash, type: 'POP' };
  }
  return hashNavigation;
};

export const useNavigationType = () => {
  const navigation = useSyncExternalStore(
    subscribe,
    getHashNavigation,
    () => initialHashNavigation,
  );
  return navigation.type;
};

export const useHashLocation: BaseLocationHook = () => {
  const location = useSyncExternalStore(
    subscribe,
    getHashLocation,
    () => '/'
  );

  const navigate = (
    to: string,
    options?: { replace?: boolean }
  ) => {
    const url = `${window.location.pathname}#${to}`;

    if (options?.replace) {
      window.history.replaceState(null, '', url);
    } else {
      window.history.pushState(null, '', url);
    }

    // Publish the type together with its destination, including query-only changes.
    hashNavigation = {
      hash: window.location.hash,
      type: options?.replace ? 'REPLACE' : 'PUSH',
    };
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };

  return [location, navigate];
};

const useHashSearch = (): string => {
  const location = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => ''
  );
  const queryIndex = location.indexOf('?');
  if (queryIndex === -1) {
    return '';
  }
  return location.slice(queryIndex + 1);
};

type SetSearchParams = (
  next:
    | URLSearchParams
    | string
    | Record<string, string>
    | ((prev: URLSearchParams) => URLSearchParams),
  options?: { replace?: boolean }
) => void;

const useHashSearchParams = (): [
  URLSearchParams,
  SetSearchParams
] => {
  const [location, navigate] = useHashLocation();
  const search = useHashSearch();

  const searchParams = useMemo(
    () => new URLSearchParams(search),
    [search]
  );

  const setSearchParams = useCallback<SetSearchParams>(
    (next, options) => {
      const params = (

        typeof next === 'function'
          ? next(new URLSearchParams(search))
          : new URLSearchParams(next)
      );

      const pathname = location.split('?')[0] ?? '/';
      const query = params.toString();

      navigate(
        query ? `${pathname}?${query}` : pathname,
        { replace: options?.replace ?? false }
      );
    },
    [location, navigate, search]
  );

  return [searchParams, setSearchParams];
};

export const useSearch = useHashSearch;
export const useSearchParams = useHashSearchParams;

export const useLocation = (): URL => {
  const [location] = useLocationWouter();
  const search = useSearch();
  let url;
  try {
    url = new URL(location, window.location.origin);
  } catch (err) {
    // Qt custom schemes may not provide a usable origin
    url = new URL(location, window.location.href);
  }
  url.search = search;

  return url;
};
