---
title: "XLD - X Lossless Decoder: How to Create Flawless CD Rips on Mac OS X
"
---

This guide will show you how to configure [url=http://tmkk.undo.jp/xld/index_e.html]XLD (X Lossless Decoder)[/url] to transcode lossless files, such as FLAC, to lossy formats. This guide will specifically show you the necessary steps to output MP3 files in What.CD’s three preferred MP3 bitrates: 320kbps CBR, and the V0 and V2 quality settings (‘presets’) for variable bit rate. 

As we can see from the trump chart featured in rule [rule]2.2.0[/rule], these settings trump all other MP3 and AAC presets.

[align=center]<IMAGE_LINK>[/align]

By the end of this tutorial, you will have saved these settings to a profile in XLD for easy access in future. When this profile is selected, all you need do is open your lossless files with XLD, and it will automatically create separate, clearly labelled directories containing each preset.

Let’s begin by opening [i]Preferences[/i] from the XLD menu, or pressing [code]Cmd + ,[/code] on your keyboard. 

====Choosing formats and output directories====
Our first step is to configure the three MP3 output formats mentioned above. Even if you only want to output one of the MP3 formats, it’s still a good idea to use the method given below – we’ll see why shortly. 

On [i]Preferences > General[/i], select the Output format dropdown, and select ‘Multiple Formats’. Next click the Options box.

[align=center]<IMAGE_LINK>
[size=1]We're only interested in the top two options here.[/size][/align]

At the top of the Options panel, select ‘LAME MP3’ from the dropdown, then click ‘Add’.

First, we’ll add 320 CBR. Set the options so they look like the image below, then click OK. Next, click ‘Add’ again, and this time use the V2 settings, then the V0 settings. 

[align=center]<IMAGE_LINK>
[size=1]Click to expand[/size][/align]

Your options dialogue should now look like the left of the image below. Double click each option and rename it as shown, before clicking OK to return to the [i]Preferences > General[/i] pane.

[align=center]<IMAGE_LINK>
[size=1]Click to expand[/size][/align]

Each directory will now be labelled with these shorter names instead of the much longer ones. This is why ‘Multiple Formats’ can be handy even if you’re only using one bitrate – it will save you having to rename the folders. 

'Output directory' is personal preference; this does not change anything other than where XLD will put the files for you. 

====Naming our outputs====
[align=center]<IMAGE_LINK>[/align]
Next we move to [i]Preferences > File Naming[/i].
Under ‘Format of filename’, we will enter the custom value of
[quote][code]%A - %T (%y) [%f]/%n %t[/code][/quote]
This will produce directories that look like this:
[quote][code]Album Artist - Album Title (2016) [MP3 320][/code][/quote]
With the files inside named as:
[quote][code]01 Song Title.mp3
02 Song Title.mp3
…[/code][/quote]

The [code]%f[/code] tag directly uses the names we entered above in the Multiple Format options, so you can see why we reduced their length. 

For a compilation album, featuring various artists, please use
[quote][code]%A - %T (%y) [%f]/%n - %a - %t[/code][/quote]

This will add the song artist ([code]%a[/code]) to the track filename. These formats are [b]highly recommended[/b], but are not compulsory, and you are free to use your own. However, please remember that clearly labelled folders and filenames can be easier to find and work with on your system, and that the rules require the MP3 files be in their own folder with [i]at least[/i] the album title. Be especially careful when copying the above examples that no leading spaces are included, as these are trumpable. 

The available tags to use for custom output are as follows: 
[hide=Show all tags][code]%A[/code] – album artist
[code]%T[/code] – album title
[code]%c[/code] – composer
[code]%I[/code] – disc ID
[code]%D[/code] – disc number
[code]%f[/code] – format 
[code]%g[/code] – genre
[code]%i[/code] – ISRC
[code]%m[/code] – MCN
[code]%a[/code] – track artist
[code]%n[/code] – track number
[code]%t[/code] – track title
[code]%y[/code] – year[/hide]

This information is sourced from the tags on the files we’re transcoding, so make sure your tags are correct first!

At this point, it’s useful to add the rules for replacing characters in filenames. [url=https://what.cd/wiki.php?action=article&id=1202]Certain characters are forbidden[/url] in What.CD torrents, and your torrent will be rejected if they’re included. 

Add all of these characters in the second section of [i]Preferences > File Naming[/i]. You can either replace them with an underscore (to show another character should have been there), or nothing at all. 
[quote][code]<    >    :    “    \    /    |    ?    *[/code][/quote]

====Adding Metadata to our files====
On [i]Preferences > Metadata[/i], set the options as below. This will ensure the MP3 files we’re transcoding feature the same tags as the lossless file. 

[align=center]<IMAGE_LINK>[/align]

====Save the Settings to a Profile====
XLD features the ability to save the current settings to a named profile. You can then use different settings of your choosing, safe in the knowledge that your What.CD transcoding preferences can be instantly restored. 

Select ‘Profile’ from the menubar, choosing ‘Save Current Settings as…”

[align=center]<IMAGE_LINK>[/align]

A new dialogue will open, prompting you to enter a name of your choosing. In the example image, you can see several configurations have been created to suit different needs. You can use this tutorial as a basis for creating your own desire profiles.

[b][i]That’s it![/i][/b] All you need to do now is open the files in XLD, and it will spit out three perfectly named folders with transcodes for you. Happy transcoding!
