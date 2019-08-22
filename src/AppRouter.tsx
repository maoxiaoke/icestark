import * as React from 'react';
import * as urlParse from 'url-parse';
import AppRoute from './AppRoute';
import { ICESTSRK_NOT_FOUND } from './constant';
import matchPath from './util/matchPath';
import recordAssets from './util/recordAssets';
import { setIcestark } from './util/index';

type RouteType = 'pushState' | 'replaceState';

export interface AppRouterProps {
  onRouteChange?: (
    pathname: string,
    query: object,
    hash?: string,
    type?: RouteType | 'init' | 'popstate',
  ) => void;
  ErrorComponent?: any;
  LoadingComponent?: any;
  NotFoundComponent?: any;
  useShadow?: boolean;
}

interface AppRouterState {
  url: string;
  forceRenderCount: number;
}

export default class AppRouter extends React.Component<AppRouterProps, AppRouterState> {
  private originalPush: (state: any, title: string, url?: string) => void =
    window.history.pushState;

  private originalReplace: (state: any, title: string, url?: string) => void =
    window.history.replaceState;

  static defaultProps = {
    ErrorComponent: <div>js bundle loaded error</div>,
    NotFoundComponent: <div>NotFound</div>,
    useShadow: false,
  };

  constructor(props: AppRouterProps) {
    super(props);
    this.state = {
      url: location.href,
      forceRenderCount: 0,
    };
    recordAssets();
  }

  componentDidMount() {
    this.hijackHistory();
    this.handleRouteChange(location.href, 'init');
    setIcestark('handleNotFound', this.handleNotFound);
  }

  componentWillUnmount() {
    this.unHijackHistory();
    setIcestark('handleNotFound', null);
  }

  /**
   * Render NotFoundComponent
   */
  handleNotFound = () => {
    this.setState({ url: ICESTSRK_NOT_FOUND });

    // Compatible processing return renderNotFound();
    return null;
  };

  /**
   * Hijack window.history
   */
  hijackHistory = (): void => {
    // hijack route change
    window.history.pushState = (state: any, title: string, url?: string, ...rest) => {
      this.originalPush.apply(window.history, [state, title, url, ...rest]);
      this.handleStateChange(state, url, 'pushState');
    };
    window.history.replaceState = (state: any, title: string, url?: string, ...rest) => {
      this.originalReplace.apply(window.history, [state, title, url, ...rest]);
      this.handleStateChange(state, url, 'replaceState');
    };

    window.addEventListener('popstate', this.handlePopState);
  };

  /**
   * Unhijacking history
   */
  unHijackHistory = (): void => {
    window.history.pushState = this.originalPush;
    window.history.replaceState = this.originalReplace;

    window.removeEventListener('popstate', this.handlePopState);
  };

  /**
   * Trigger statechange: pushState | replaceState
   */
  handleStateChange = (state: any, url: string, routeType?: RouteType): void => {
    // deal with forceRender
    if (state && (state.forceRender || (state.state && state.state.forceRender))) {
      const { forceRenderCount } = this.state;
      this.setState({ url, forceRenderCount: forceRenderCount + 1 });
    } else {
      this.setState({ url });
    }
    this.handleRouteChange(url, routeType);
  };

  /**
   * Trigger popstate
   */
  handlePopState = (): void => {
    const url = location.href;

    this.setState({ url });
    this.handleRouteChange(url, 'popstate');
  };

  /**
   * Trigger onRouteChange
   */
  handleRouteChange = (url: string, type: RouteType | 'init' | 'popstate'): void => {
    const { pathname, query, hash } = urlParse(url, true);
    this.props.onRouteChange(pathname, query, hash, type);
  };

  render() {
    const { NotFoundComponent, ErrorComponent, LoadingComponent, useShadow, children } = this.props;
    const { url, forceRenderCount } = this.state;

    const { pathname, query } = urlParse(url, true);
    const { localUrl } = query;

    let match: any = null;
    let element: any;

    React.Children.forEach(children, child => {
      if (match == null && React.isValidElement(child)) {
        element = child;

        const { path } = child.props as any;

        match = path ? matchPath(pathname, { ...child.props }) : null;
      }
    });

    const extraProps: any = {
      ErrorComponent,
      LoadingComponent,
      useShadow,
      forceRenderCount,
    };
    if (localUrl) {
      extraProps.url = localUrl;
    }

    let realComponent: any = null;
    if (match) {
      const { path, basename } = element.props as any;

      setIcestark('basename', basename || (Array.isArray(path) ? path[0] : path));

      realComponent = React.cloneElement(element, extraProps);
    } else if (url === ICESTSRK_NOT_FOUND) {
      realComponent = (
        <AppRoute
          path={ICESTSRK_NOT_FOUND}
          url={ICESTSRK_NOT_FOUND}
          NotFoundComponent={NotFoundComponent}
          useShadow={useShadow}
        />
      );
    }
    return realComponent;
  }
}
