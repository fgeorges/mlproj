module namespace foo = "http://mlproj.org/example/simple-chimay/lib/foo.xqy";

declare function foo:hello($who)
{
   'Hello, ' || $who || '!'
};
