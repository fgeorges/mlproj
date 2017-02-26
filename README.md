# mlproj

## TODO

- publish on npmjs
    - https://www.npmjs.com/package/mlproj
    - https://docs.npmjs.com/getting-started/publishing-npm-packages
	- http://blog.npmjs.org/post/118810260230/

- word lexicons
- drive properties by configuration (on a property-by-property basis)
    - start with simple properties, like URI and collection lexicons
	- create two such arrays, in cmp.Database and cmp.Server
	- its names (in spaces and api, or JPath), default value, scalar
      or array?, is it "changeable"?, etc.
- allow changing a server port, as it restarts the instance

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
