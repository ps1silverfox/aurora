'use strict';

// Simple test plugin: registers a content.published action hook.
// Tests attach a spy via module.exports.__spy before activating.

let _actionCallback = null;

module.exports = {
  activate(ctx) {
    _actionCallback = (...args) => {
      if (typeof module.exports.__spy === 'function') {
        module.exports.__spy(...args);
      }
    };
    ctx.hooks.addAction('content.published', _actionCallback);
  },
  deactivate() {
    _actionCallback = null;
  },
  __spy: null,
};
