# mlproj

## TODO

- env as first arg of the command line (+ -f option)
- word lexicons
- url rewriter and error handler
- publish on npmjs
    - https://www.npmjs.com/package/mlproj
    - https://docs.npmjs.com/getting-started/publishing-npm-packages
	- http://blog.npmjs.org/post/118810260230/

- drive properties by configuration (on a property-by-property basis)
    - start with simple properties, like URI and collection lexicons
	- its names (in spaces and api), default value, scalar/array, etc.

Change actions from:

```
new act.Put(
    '/databases/' + this.db.name + '/properties',
    body,
    'Update indexes:  \t' + this.db.name));
```

to:

```
new act.ChangeDatabaseProperty(
    this.db.name,
    body,
    'Update indexes:  \t' + this.db.name));
```
