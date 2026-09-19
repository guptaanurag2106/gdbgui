Before running `gdbgui`, you should compile your program with debug symbols and a lower level of optimization, so code isn't optimized out before runtime. To include debug symbols with `gcc` use `-ggdb`, with `rustc` use `-g`. To disable most optimizations in `gcc` use the `-O0` flag, with `rustc` use `-O`.

For more details, consult your compiler's documentation or a search engine.

Now that you have `gdbgui` installed and your program compiled with debug symbols, all you need to do is run
```
gdbgui
```

This will start gdbgui's server and open a new tab in your browser. That tab contains a fully functional frontend running `gdb`!

You can see gdbgui in action on [YouTube](https://www.youtube.com/channel/UCUCOSclB97r9nd54NpXMV5A).

To see the full list of options gdbgui offers, you can view command line options by running
```
gdbgui --help
```

If you have a question about something

* Read documentation on the [homepage](https://github.com/guptaanurag2106/gdbgui/)
* [Ask question in an issue on github](https://github.com/guptaanurag2106/gdbgui/issues)


## Settings
`gdbgui` settings can be accessed by clicking the hamburger menu in the top right of the frontend. These settings persist between sessions for a given url and port.


## Keyboard Shortcuts
The following keyboard shortcuts are available when the focus is not in an input field. They have the same effect as when the button is pressed.

* Run: r
* Continue: c
* Next: n or right arrow
* Step: s or down arrow
* Up: u or up arrow
* Next Instruction: m
* Step Instruction: ,


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
