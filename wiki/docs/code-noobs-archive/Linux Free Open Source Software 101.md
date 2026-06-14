Linux, Free and Open Source Software 101
--

A Short History
---------------

Free and Open Source Software (FOSS) - freeware and open source. For more detailed technical and philosophical definitions see: https://en.wikibooks.org/wiki/FOSS_Open_Standards/Introduction

Early on, closed-source software was uncommon until the mid-1970s to the 1980s, when [IBM implemented in 1983 an "object code only" policy](https://www.landley.net/history/mirror/ibm/oco.html), no longer distributing source code. IBM's stated reason for this was users would make modifications to their source and IBM was expected to support these changes, which was unfeasible. Nothing in open source was formalized until when at MIT Richard Stallman began the GNU (GNU is Not [Unix](https://www.opengroup.org/membership/forums/platform/unix)) project in 1984, which created critical tools that formed a portion for an Open Source operating system. It was however missing the most critical piece: the kernel.

![](https://lh6.googleusercontent.com/2QgL-khz54PdOCgf1l6CesR2L79ErfYKPX4vfDsIPJ_62LNxmrRMQCkV9frLzbMq3Zs3LGDyB3CFbPxmR6fOJQk7g4wRGKW6VYb8spFnMfZ-qvrhpcVurimvTr9J1eQ3UhKHYoIC)

On most systems, it is one of the first programs loaded on start-up (after the bootloader). It handles the rest of start-up as well as input/output requests from software, translating them into data-processing instructions for the central processing unit. It handles memory and peripherals like keyboards, monitors, printers, and speakers.

In 1991, Linus Torvalds, who at the time was a second year graduate student at the University of Helsinki, wrote and distributed a Unix-like kernel ([what's Unix?](https://kb.iu.edu/d/agat)). In the manner of FOSS development, it was distributed widely, improved upon and soon adapted to become the core of the GNU/Linux operating system.

The Cathedral and the Bazaar
----------------------------

A comparison used in an essay written comparing two models of software:\
The Cathedral model, in which source code is available with each software release, but code developed between releases is restricted to an exclusive group of software developers. GNU Emacs and GCC were presented as examples.

The Bazaar model, in which the code is developed over the Internet in view of the public. Raymond credits Linus Torvalds, leader of the Linux kernel project, as the inventor of this process. Raymond also provides anecdotal accounts of his own implementation of this model for the Fetchmail project.

In full:

http://www.unterstein.net/su/docs/CathBaz.pdf

Abstract:

> I anatomize a successful open-source project, fetchmail, that was run as a deliberate test of some surprising theories about software engineering suggested by the history of Linux. I discuss these theories in terms of two fundamentally different development styles, the "cathedral" model of most of the commercial world versus the "bazaar" model of the Linux world. I show that these models derive from opposing assumptions about the nature of the software-debugging task. I then make a sustained argument from the Linux experience for the proposition that "Given enough eyeballs, all bugs are shallow", suggest productive analogies with other self-correcting systems of selfish agents, and conclude with some exploration of the implications of this insight for the future of software.

Distributions

---------------

To package and distribute your own operating system running the Linux kernel is commonplace today. There are virtually limitless "distros" available, with more being created every day. They vary greatly in terms of ease-of-use, technical capability, and are all fairly customizable (some more than others). Starting with Linux today, I'd recommend Linux Mint which is based on the popular Ubuntu (which has lost favorability due to some changes over the years).

For an up-to-date list on the current most popular distros see: https://distrowatch.com/dwres.php?resource=major

A similar concept are repositories, which now are commonplace on other OS. Unlike some other OS though, you can easily add third party repositories (for better or worse).

The Command Line
----------------

While it isn't necessary, there does seem to be a correlation with users who use Linux and those who also use the command line. If you've ever used the command prompt in Windows, it's a similar concept, you enter commands via typed commands into a virtual terminal. This process allows you to communicate directly to the kernel and issue commands that (for better or worse) give you absolute control over the Operating System.

A great resource for learning this is "The Linux Command Line" by William E. Shotts, Jr. which can be purchased: https://nostarch.com/tlcl or is available online: https://www.linuxzasve.com/preuzimanje/TLCL-09.12.pdf

| Command                                          | Explanation                                           |
|--------------------------------------------------|-------------------------------------------------------|
| pwd Shows the full path of the current directory |
| ls                                               | Lists all files in the current directory              |
| ls -al                                           | Lists all files and information                       |
| ls -alR                                          | Lists all files and information in all subdirectories |
| ls -alR > filename.txt                           | Same as ls -alR, outputs results to a file            |
| cd [directory name]                              | Changes to a new directory                            |
| cd ..                                            | Changes to the directory above current one            |
| cat [file name]                                  | Show content of file                                  |
| mkdir [directory name]                           | Make a directory                                      |
| clear                                            | Clears the screen                                     |


Further Reading
-------------------

[Linode: Introduction to Linux Concepts](https://www.linode.com/docs/tools-reference/introduction-to-linux-concepts/)

[Producing Open Source Software](https://producingoss.com/)

[Forge Your Future with Open Source](https://pragprog.com/book/vbopens/forge-your-future-with-open-source)

[The Art of Community](http://www.artofcommunityonline.org/about/) ([PDF](http://www.artofcommunityonline.org/downloads/jonobacon-theartofcommunity-1ed.pdf))

[Is it GNU/Linux or is it Linux? Wikipedia's History of the Controversy](https://en.wikipedia.org/wiki/GNU/Linux_naming_controversy)

Screenshots
-----------

[Arch Gaussian Blur](https://drive.google.com/file/d/1cUHXcPnTLMcc0tNhha6pP7E9t0OeM3fx/view?usp=sharing)

[Minimal Linux Mint Desktop](https://i.redd.it/24wdyel1ihk11.png)

![](https://lh4.googleusercontent.com/c6GtA0vo3S4FFW9l-ksmUQvUN-O86K8bI6zEEluxAW6DIGi52NzetYEto2u1sloaxtrEEyNaMjZI5Dg-rvvttYYfgTIavPCZSDTw-NBRlFvhNqvR6H65P-kOeG6IxpQ8Yd3ibRkU)

![](https://lh4.googleusercontent.com/CSxICCJ3HI0C60CAiZfxiNNJIxTRFgAooW6m-NsVk5ZqCWxGe2uHVNqIzhOS4RGaiNQrbInUIkjRVGfO8o1ckBI_iSzziSeoQtRjoRsruYlp0WwyaFCjfaEsO79vBooSTKeZDfqm)

![](https://lh4.googleusercontent.com/mb8xDUs4veUe1ZaUagZnCCS3fPK643kbo_gslj2TYIn25EWgItGT76AZfkAdW16CPZ1mpbC-aGDMNinclCCLRwn9_AbjAIwTlLF_aPLGPcuoq0ScBIbzluzdbTcgBHygoc4zdwK_)

----