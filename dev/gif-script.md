Notes on the making of the animated GIF.

I use the following Emacs packages to help with resp. capturing the screencast
and convert it to a GIF, and to script the animation in Emacs:

- https://github.com/Malabarba/camcorder.el
- https://github.com/vermiculus/package-demo

Once `package-demo` loaded, we can execute:

```lisp
(package-demo--run-demo
 '((M-x eshell)
   (pause 1)
   (typewriter "ls -aol")
   (pause 1)
   (kbd "RET")))
```

In order to capture the screencast for these actions, let's invoke `camcorder`
right after opening a new EShell buffer:

```lisp
(package-demo--run-demo
 '((M-x eshell)
   (M-x camcorder-record)
   (pause 1)
   (typewriter "ls -aol")
   (pause 1)
   (kbd "RET")))
```

We still need to manually:

- fill in the output file for camcorder
- stop the recording by pressing `F12` manually

Here is the full script (using `ansi-term` for now, colours are not displayed
proeprly in EShell):

```lisp
;; change dir to the target demo project dir
(cd "/tmp/example")
;; empty it (it is a *MESS* to deal with errors while recording)
(delete-directory "/tmp/example/xproject/" t)
;; force colors, or chalk won't deliver them to EShell
(setenv "FORCE_COLOR" "on")

;; launch the demo and recording
(package-demo--run-demo
 '((M-x eshell)
   (M-x camcorder-record)
   (pause 1)
   ;; (typewriter "mlproj new")
   (typewriter "mlproj new")
   (kbd "RET")
   (pause 1)
   (typewriter "awesome")
   (kbd "RET")
   (pause 1)
   (typewriter "My awesome project")
   (kbd "RET")
   (pause 1)
   ;; (typewriter "http://example.org/proj/awesome")
   (kbd "RET")
   (pause 1)
   (typewriter "1.0")
   (kbd "RET")
   (pause 1)
   (kbd "RET")
   (pause 1)
   (typewriter "mlproj -e prod show")
   (kbd "RET")
   (pause 2)
   (typewriter "mlproj -e prod setup")
   (kbd "RET")
   (pause 1)))
```

We can then convert the video file to GIF using `M-x
camcorder-convert-to-gif`, with the configured command for `ffmpeg`.
