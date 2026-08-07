---
title: "XLD - X Lossless Decoder: How to Burn a Perfect Copy with a Cue Sheet"
---

### Introduction
If you haven't already, download XLD from [url=http://tmkk.pv.land.to/xld/index_e.html]http://tmkk.pv.land.to/xld/index_e.html[/url].

==Burning==
[b]If you haven't configured XLD for disc burning please see the "Finding the correct write offset" section below.[/b]

Begin by opening the ".cue" file in the directory with XLD:
<IMAGE_LINK>

You should get a window that looks like the following:
<IMAGE_LINK>
Insert a blank CD, hit "Ignore" if the "You inserted a blank CD" dialog comes up and hit "Burn CD."

Set the check-boxes as necessary. "Test Only" and "Leave Disc Appendable" should unchecked. If you are trying to find the correct write offset deselect "Verify burned data":
<IMAGE_LINK>

==Finding the correct write offset==
First follow [url=http://what.cd/wiki.php?action=article&id=146]this[/url] to, at least, correctly set the read offset in the CD Rip tag in XLD's preferences. Also make sure the disc you are burning is in the AccurateRip database.

Make sure that "Write samples offset" is 0 in the "CD Burn" section of the preferences:
<IMAGE_LINK>

Follow the steps to burn a disc in the "Burning" section above.

When the burn finishes make sure the disc is still in the drive, then go to XLD and open the CD: File > Open > Open Audio CD > Name of CD (Command + Shift +O). You may have to refresh the list: File > Open > Open Audio CD > Refresh List (Command + Shift + R). If nothing works eject the CD and try again.

In the window hit "Extract" and if necessary choose a directory to extract to:
<IMAGE_LINK>

When the extraction is finished the extraction log window will open:
<IMAGE_LINK>
Enter the number in the "Relative" column from the "List of alternative offset values" section in the "CD Burn" tab in the preferences window. The first row probably has the correct value:
<IMAGE_LINK>

==Possible Issues==
Files not found:
If you get an error about a file not being found, then you may need to open the ".cue" file with TextEdit:
<IMAGE_LINK>
Here the ".cue" file is referencing files with a ".wav" extension. Remedy this by doing a find (Command+F) and replace (tick the replace check box) and fill in fields as shown below. Hit "all" then save. (For copy and paste: Find: .wav" WAVE Replace: .flac" FLAC)
<IMAGE_LINK>

==From the XLD website==
[quote=XLD]Clicking "Burn CD" button in the toolbar of the track list window triggers a CD burner. Apple's standard CD burner GUI will appear and proceed.

Note that the verification process requires an offset correction, so both read/write offset value (in CD Burn pref) should be set correctly for the exact match. Otherwise the verification will fail. If you are not sure about the write offset of your drive, burn AccurateRip verifiable image with the write offset 0, and rip the burned disc with the correct read offset. Then, the AR report will suggest offset values, and the relative one will be the write offset.

[b]Here is a current status list of the XLD burner:[/b]
[b]XLD does[/b]
[*]write flac/ape/wv/etc+cue image to CD directly
[*]take care of write offset
[*]reproduce pregap length
[*]write ISRC/MCN
[*]write pre-emphasis/DCP flag 
[b]XLD does not (at this moment)[/b]
[*]handle HTOA perfectly
[*]Due to the limitation of Apple's framework, some drives fail to burn images including hidden track one audio (HTOA) (MATSHITA will work, NEC/Pioneer will not). And HTOA longer than 1 second is truncated.
[*]create Mixed Mode CD
[*]create Enhanced CD (CD-Extra)
[*]write CD-Text [/quote]
