export interface BasicAuth {
  username: string;
  password: string;
}

export interface RequestProxy {
  url: string;
  basicAuth?: BasicAuth;
}

export class ProxyProvider {
  public get_proxy(): RequestProxy | null {
    return null;
  }
  public invalidate_proxy(proxy: RequestProxy) {
    proxy;
    return;
  }
}

export class SimpleProxyProvider extends ProxyProvider {
  private _proxies: RequestProxy[];
  private _allow_invalidate: boolean;
  constructor(proxies: RequestProxy[], allow_invalidate: boolean = true) {
    super();
    this._proxies = proxies;
    this._allow_invalidate = allow_invalidate;
  }
  public override get_proxy(): RequestProxy {
    return this._proxies[Math.floor(Math.random() * this._proxies.length)];
  }
  public override invalidate_proxy(proxy_obj: RequestProxy) {
    if (!this._allow_invalidate) {
      return;
    }
    const target_idx = this._proxies.findIndex((elem) => {
      if (elem.url !== proxy_obj.url) {
        return false;
      }
      return true;

      //   if (elem.basicAuth !== undefined) {
      //     return elem.basicAuth?.username === elem.basicAuth?.username &&
      //       elem.basicAuth?.password === proxy_obj.basicAuth?.password;
      //   }
    });
    if (target_idx !== -1) {
      this._proxies.splice(target_idx, 1);
    }
    return;
  }
}
