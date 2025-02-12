export interface RequestProxy {
  url: string;
}

export class ProxyProvider {
  public get_proxy(): RequestProxy | null {
    return null;
  }
  public invalidate_proxy(proxy: RequestProxy) {
    proxy;
    return null;
  }
}

export class SimpleProxyProvider extends ProxyProvider {
  private _proxies: RequestProxy[];
  constructor(proxies: string[]) {
    super();
    this._proxies = [];
    for (const url of proxies) {
      this._proxies.push({ url: url });
    }
  }
  public override get_proxy(): RequestProxy {
    return this._proxies[Math.floor(Math.random() * this._proxies.length)];
  }
  public override invalidate_proxy(proxy_obj: RequestProxy) {
    const target_idx = this._proxies.findIndex((elem) => {
      elem.url = proxy_obj.url;
    });
    if (target_idx != -1) {
      this._proxies.splice(target_idx, 1);
    }
    return null;
  }
}
