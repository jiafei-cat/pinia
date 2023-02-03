import { Pinia, PiniaPlugin, setActivePinia, piniaSymbol } from './rootStore';
import { ref, App, markRaw, effectScope, isVue2, Ref } from 'vue-demi';
import { registerPiniaDevtools, devtoolsPlugin } from './devtools';
import { USE_DEVTOOLS } from './env';
import { StateTree, StoreGeneric } from './types';

/**
 * 创建pinia实例
 * 1. 初始化activi effect scope
 * 2. 初始化state
 * 3. 处理plugin
 * 4. 将pinipa实例共享到vue.provide和vue.config.globalProperties
 */
export function createPinia(): Pinia {
  const scope = effectScope(true);
  // NOTE: here we could check the window object for a state and directly set it
  // if there is anything like it with Vue 3 SSR
  /**
   * state => ref
   * action => function
   * getter => compouted
   * @todo effectScope 作用
   */
  const state = scope.run<Ref<Record<string, StateTree>>>(() =>
    ref<Record<string, StateTree>>({})
  )!;
  /** _p是安装的插件列表 */
  let _p: Pinia['_p'] = [];
  // plugins added before calling app.use(pinia)
  /** 在vue.use前pinia.use的等待安装的插件列表，当vue.use(pinia instance)后推入到pinia._p中 */
  let toBeInstalled: PiniaPlugin[] = [];

  /**
   *
   * @doc markRaw 如果在代理前不希望某些对象被代理，可以使用markRaw将其标记为不需要代理(markRaw通过给对象设置__v_skip避免被代理)
   */
  const pinia: Pinia = markRaw({
    install(app: App) {
      // this allows calling useStore() outside of a component setup after
      // installing pinia's plugin
      /** 设置当前的activei pinia */
      setActivePinia(pinia);
      if (!isVue2) {
        pinia._a = app;
        /** 将数据存放于provide */
        app.provide(piniaSymbol, pinia);
        /** 方便this.$pinia使用, 在vue2是直接写在prototype上，vue3为了更好的类型支持单独写在config globalProperties上 */
        app.config.globalProperties.$pinia = pinia;
        /* istanbul ignore else */
        if (USE_DEVTOOLS) {
          registerPiniaDevtools(app, pinia);
        }
        toBeInstalled.forEach((plugin) => _p.push(plugin));
        toBeInstalled = [];
      }
    },

    use(plugin) {
      if (!this._a && !isVue2) {
        toBeInstalled.push(plugin);
      } else {
        _p.push(plugin);
      }
      return this;
    },
    /** pinia插件列表 */
    _p,
    // it's actually undefined here
    // @ts-expect-error
    /** vue实例 */
    _a: null,
    _e: scope,
    _s: new Map<string, StoreGeneric>(),
    /** state对象(响应式) */
    state,
  });

  // pinia devtools rely on dev only features so they cannot be forced unless
  // the dev build of Vue is used. Avoid old browsers like IE11.
  if (USE_DEVTOOLS && typeof Proxy !== 'undefined') {
    pinia.use(devtoolsPlugin);
  }

  return pinia;
}
