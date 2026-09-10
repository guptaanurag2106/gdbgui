
# Examples
## Code Examples
View code examples on [GitHub](https://github.com/guptaanurag2106/gdbgui/tree/master/examples).

## gdbgui Invocation Examples

launch gdbgui

```
gdbgui
```

set the inferior program, pass argument, set a breakpoint at main

```
gdbgui --args ./myprogram myarg -myflag
```


```
gdbgui "./myprogram myarg -myflag"
```

use gdb binary not on your $PATH

```
gdbgui --gdb-cmd build/mygdb
```

Pass arbitrary arguments directly to gdb when it is launched

```
gdbgui --gdb-cmd="gdb -x gdbcmds.txt"
```

run on port 8080 instead of the default port

```
gdbgui --port 8080
```



run on a server and host on 0.0.0.0. Accessible to the outside world as long as port 80 is not blocked.

```
gdbgui -r
```

Use Mozilla's [record and replay](https://rr-project.org) (rr) debugging supplement to gdb. rr lets your record a program (usually with a hard-to-reproduce bug in it), then deterministically replay it as many times as you want. You can even step forwards and backwards.
```
gdbgui --gdb-cmd "rr replay --"
```

Use recording other than the most recent one

```
gdbgui --gdb-cmd "rr replay RECORDED_DIRECTORY --"
```

Don't automatically open the browser when launching

```
gdbgui -n
```
