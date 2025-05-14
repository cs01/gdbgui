const originalAjax = $.ajax;
const base = window.location.pathname.replace(/\/$/, '');
console.log("AjaxOverride");

$.ajax = function (options: any) {
  // You can customize the options here
  const modifiedOptions = {
    ...options,
    url: base + options.url
  };

  return originalAjax.call(this, modifiedOptions);
};
