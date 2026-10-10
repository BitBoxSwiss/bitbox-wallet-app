import { useEffect, type ReactNode } from 'react';
import {
  Link,
  Switch,
  useLocation as useLocationWouter,
  useSearch,
} from 'wouter';

export const useLocation = (): URL => {
  const [location] = useLocationWouter();
  const search = useSearch();

  const url = new URL(location, window.location.origin);
  url.search = search;

  return url;
};

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
