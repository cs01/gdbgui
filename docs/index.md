<p align="center">
<a href="http://gdbgui.com"><img src="https://github.com/cs01/gdbgui/raw/master/images/gdbgui_banner.png"></a>
</p>

<h2 align="center">
A modern, browser-based frontend to gdb (gnu debugger)
</h2>

<p align="center">
<a href="https://github.com/cs01/gdbgui/raw/master/screenshots/gdbgui_animation.gif">
<img src="https://github.com/cs01/gdbgui/raw/master/screenshots/gdbgui_animation.gif">
</a>

</p>


`gdbgui` is a browser-based frontend to `gdb`, the [gnu debugger](https://www.gnu.org/software/gdb/). You can add breakpoints, view stack traces, and more in C, C++, Go, and Rust!

It's perfect for beginners and experts. Simply run `gdbgui` from the terminal to start the gdbgui server, and a new tab will open in your browser.

`gdbgui` works by using gdb's [machine interface](https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI.html). gdbgui runs gdb as a subprocess, then sends and reads machine interface data to create an interactive user interface. You can learn more about how it works [here](howitworks.md).



## Testimonials
gdbgui is used by thousands of developers around the world including engineers at Google and college computer science course instructions. It even made its way into the Rust programming language's [source code](https://github.com/rust-lang/rust/blob/master/src/etc/rust-gdbgui) and appeared on episode [110 of C++ Weekly](​https://youtu.be/em842geJhfk).

<span style="font-style: italic;">I've only used @grassfedcode's gdbgui for a couple of days, but wow, it's pretty awesome and so dead simple to get up an running.</span> —[Lou](https://twitter.com/DragonmasterLou/status/959449422630408192)

<span style="font-style: italic;">Seriously, great front-end to gdb for those of us who are not always using a full IDE. Great project.</span> —[Jefferson](https://twitter.com/jeffamstutz/status/955647577373978624)

<span style="font-style: italic;">Where were you all my life? And why did I use DDD?</span> —[Mario](https://twitter.com/badlogicgames/status/925079139446591490)

## License

gdbgui's license is GNU GPLv3. To summarize it, you

- can use it for free at work or for personal use
- can modify its source code
- must disclose your source code if you redistribute any part of gdbgui

## Distribution

gdbgui is distributed through

- github ([https://github.com/cs01/gdbgui](https://github.com/cs01/gdbgui))
- [PyPI](https://pypi.python.org/pypi/gdbgui/)

## Authors

- Chad Smith, creator/maintainer
- @bobthekingofegypt, contibutor
- [Community contributions](https://github.com/cs01/gdbgui/graphs/contributors)

## Donate

Please consider donating to support continued development of gdbgui: [Paypal](https://www.paypal.me/grassfedcode/20)

## Contact

grassfedcode@gmail.com
