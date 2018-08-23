# tymly-rbac-plugin
[![Tymly Plugin](https://img.shields.io/badge/tymly-plugin-blue.svg)](https://tymly.io/)
[![npm (scoped)](https://img.shields.io/npm/v/@wmfs/tymly-rbac-plugin.svg)](https://www.npmjs.com/package/@wmfs/tymly-rbac-plugin)
[![Build Status](https://travis-ci.org/wmfs/tymly-rbac-plugin.svg?branch=master)](https://travis-ci.org/wmfs/tymly-rbac-plugin)
[![codecov](https://codecov.io/gh/wmfs/tymly-rbac-plugin/branch/master/graph/badge.svg)](https://codecov.io/gh/wmfs/tymly-rbac-plugin)
[![CodeFactor](https://www.codefactor.io/repository/github/wmfs/tymly-rbac-plugin/badge)](https://www.codefactor.io/repository/github/wmfs/tymly-rbac-plugin)
[![Dependabot badge](https://img.shields.io/badge/Dependabot-active-brightgreen.svg)](https://dependabot.com/)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![license](https://img.shields.io/github/license/mashape/apistatus.svg)](https://github.com/wmfs/tymly-rbac-plugin/blob/master/LICENSE)

> This plugin handles role based authentication 

...

## <a name="install"></a>Install
```bash
$ npm install tymly-rbac-plugin --save
```

Add to your list of Tymly plugin's using 
```
tymly.boot({
  blueprintPaths: [
    ...
  ],
  pluginPaths: [
    path.resolve('@wmfs/tymly-rbac-plugin'),
    ...
  ]
},
...
```

The RBAC service will initialise itself from state machine _restrictions_.  Users can be added to groups using the ensureUserRole methods, or by populating the role and role-membership tables.  

Tymly's Statebox service is RBAC aware, and so will start using this service to control access to state machines. 

## <a name="license"></a>License

[MIT](https://github.com/wmfs/tymly/blob/master/LICENSE)
