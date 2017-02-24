# mlproj

## TODO

- attribute range indexes
- collection lexicon
- word lexicons
- url rewriter and error handler
- publish on npmjs
    - https://www.npmjs.com/package/mlproj
    - https://docs.npmjs.com/getting-started/publishing-npm-packages
	- http://blog.npmjs.org/post/118810260230/

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
