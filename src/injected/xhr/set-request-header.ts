const setRequestHeader = window.XMLHttpRequest.prototype.setRequestHeader;

export function patchSetRequestHeader() {
  window.XMLHttpRequest.prototype.setRequestHeader = function (key, value) {
    this.ohHeaders[key] = value;
    return setRequestHeader.call(this, key, value);
  }
}

export function unpatchSetRequestHeader() {
  window.XMLHttpRequest.prototype.setRequestHeader = setRequestHeader;
}
