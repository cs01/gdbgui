declare module "statorgfc" {
  export let store: {
    get(key: string): any;
    set(key: string, value: any): any;
  };
}
