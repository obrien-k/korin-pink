We have an open discussion about Functions, led by Nikita. There are full audio files available in FLAC, MP3, an [interactive HTML](https://webbhost.net/env/cn/functions-html.zip) zip file, and as a text transcript below.


****Kyle:** **[00:00:07] All right so what do we know about functions already? Just so we can get our feet in the water. Do you want to start, Connor?

****Connor:** **[00:00:20] No not at all.

****Kyle:** **[00:00:23] Okay, fair enough.

****Evan:** **[00:00:29] So essentially is it makes.. It makes things do things, we need we need typically a variable and then also what would give us different sorts of functions.

****Kyle:** **[00:00:49] So let's say you're trying to count to 100. So you can pass count variable to this function and count plus plus, add that number that you have possibly infinitely. But usually you're going to have a limit of if it's less than that, that's where we're going to stop that's just functions in a real nutshelll. You can also find assign variables like three different things. I think if not more. That's what I know about functions off the top of my head.

****Nikita:** **[00:01:30] That's pretty much right. Functions just like like the basic building blocks of JavaScript of like code that that's whenver you run functions that's when your computer is actually going to be doing stuff for you. Pretty much everything is kind of, well not everything but anything that does some things like a function and there's a couple of different ways to create them and write them. We will do that in a second but like addition is a function. You could write a function to add up. You can write a function to send a request to a remote to a different server or a different computer and try and get some information back. It's really just like the the building block of everything you'd be doing.

****Connor:** **[00:02:28] It does a thing.

****Nikita:** **[00:02:30] Yeah. That's a good way of thinking about it. Like you want to do a thing. You'll probably have to write a function so this is a super simple appear in super simple add function. Let's see what we have here, can you see that, it's pretty small?

****Everyone:** **[00:04:02] Yeah yeah.

****Nikita:** **[00:04:03] I could it go down a little bit. This is this is a named function. There's a couple of different ways you can write functions. This is probably the most common one where you give it you say function like this on a computer. Hey I wonder. I tend to write a function that you can put anything you want to after that. And that's going to be the main right. Function x and that was your function. There'll be callbacks but really you need to know like you want to make these as expressive as possible. Like just by looking at this you probably know what it does. Yes of course they need it. But if I need it like X you would actually have to go inside of the code to see what it does. And that's usually not a good idea. I must be the only one reading it. So important thing. Function keyword. Got to have that you don't have to have a name like I can do it like this kind of. I'll see you how and second. But it be only writing on this. This is the first farming function for your name. And then we always have parentheses. And that's where you pass parameters and parameters are things that you're gonna need inside of your function to get like your desired result. So if I just did function and error when he didn't give any parameters and then told it return a close. What do you think would happen. I think nothing because it doesn't know what a right.

****Connor:** **[00:05:58] It's AB

****Nikita:** **[00:05:59] Exactly. Yes. So by defining by letting and know that we're gonna be passing two parameters. That's how we can kind of build on top of other functions and stuff like that it's where he gets like super complicated. He can pass another function as a parameter. As long as it returns something. So. What do you guys think would happen if I just ran this so which would get you inside.

****Connor:** **[00:06:33] Nothing because you don't have an answer. It must be as you will getting maybe seven or eight votes be it. Maybe one more spelling error. I don't know how it works in code.

****Nikita:** **[00:06:50] So here the reason that it's not showing us any means because we've just defined a function we haven't actually done anything given any value equals one equals one. Right. So I told the computer I'm going to here's the function that I may use. And then I have a number of X. Okay. So the way you can execute a function such a name one is literally just type out its name. And then we have to supply it a and b. So we'll do like two to five comes along this.

****Kyle:** **[00:07:31] That console.log just logs it to the console?

****Nikita:** **[00:07:34] So we can see it down there. So now if I was only at 7 and it's it can be as simple as that or you can be a lot more complicated you know. So if I don't want to log it I wouldn't see anything. There's ways around that but it doesn't matter. And the same thing goes for. The same goes for the Chrome browser. We go to him. My sandbox store inspect element to console or console them. Near You go right here. And this is the works exactly the same way for the most part. There's like two things that work differently but you'll probably never use them. So if you do a function add "A" comma "B". Oh this is curly brace super important everything that goes between the two curly braces is the code that's actually going to be executed. So if you don't put that it will be an error. So if you just told us some defining because I didn't technically write anything and now if I do add or I think it was thirteen which is the same thing that we saw inside of Visual Studio here. In Visual Studio Code. This is just using notes to run the code. This is using your client or your browser. It's exactly the same thing. You typically will have a return statement. And that's. Kind of self-explanatory. That's what the function is going to get back whenever you run it. So in our case we want the sum of a plus b. So we're going to tell it return A + B. This is super super simple example. We'll probably never use this.

****Connor:** **[00:09:46] This might be a dumb question. What's the purpose of the semicolon?

****Nikita:** **[00:09:50] It's a it's a line terminator so that you technically don't have to put them in JavaScript because the the thing that interprets the code well kind of it's a fairly smart and knows where to put them but it's you should be putting them everywhere.

****Connor:** **[00:10:07] Like if you want something to stop

****Nikita:** **[00:10:11] No, it's whenever whenever the computer goes line by line or read the code it knows when I had a semicolon to go to the next line and stuff like that.

****Connor:** **[00:10:23] OK.

****Nikita:** **[00:10:24] And the interpreter is fairly smart and you can usually like ninety nine percent out of 100. Figure out where you might look for the line to stop even if you don't put a semicolon in but you should be using semicolons.

****Nikita:** **[00:10:41] Yeah you can have bugs that are really hard to track down those style guides including the big commerce ones require you to use semicolons. One of the guys that wrote JavaScript said we should use semicolons.

****Connor:** **[00:10:59] So what would the difference be if you put the squiggly bracket one line up here. I mean not at all. I mean like if you put it asked right after a pause.

****Nikita:** **[00:11:12] If you could run it that way you can run this whole thing on one line if you wanted to.

****Connor:** **[00:11:17] Is that just like a personal preference deal?

****Nikita:** **[00:11:20] I mean this is the way it does the best. I know it's easier. Yeah.

****Connor:** **[00:11:26] I mean yeah I totally get it looks nicer. Yeah I was just wondering if there was a theory or a thought process as to why that way over.

****Nikita:** **[00:11:40] I don't necessarily but I've seen for readability, for people going after you and having to mess with your code

****Kyle:** **[00:11:52] I know it's CSS, like it's same conventions like there is semicolon and curly brackets, but I mean like a day and a half to figure out what is wrong with my CSS and I was missing a semicolon. Personal experience there.

****Connor:** **[00:12:05] Yeah I just. Again they do this now. Yes. This.

****Nikita:** **[00:12:10] There's no wrong questions.

****Connor:** **[00:12:12] Expect the stupidest of questions

****Nikita:** **[00:12:17] So that's formulated to a function and this kind of makes sense right. You know the function is the name of the function that you're gonna be calling parameters. This could be any number of things. There's a there's a technical limit but it's very high. And if you have that any parameters you shouldn't probably simply write one function. And we have a Return statement which is what we want the function to do or give back to us. Yeah. And that's pretty much it for this. Now this is a named function. You can also function expressions and that's where we can assign a function to a variable. So in Javascript you'd typically use the VAR keyword and then something like subtract which is what we're naming it. Equals function a comma b. So this is almost exactly the same... So it's almost exactly the same. But you've assigned this to a variable. There's there are differences but I don't know them all off the top of my head. Either way is fine. I prefer writing functions like this to my code.

****Kyle:** **[00:14:24] Is it easier to use like say, I'm thinking in terms of say I want to use that subtract function and another subtract function?

****Nikita:** **[00:14:35] Shouldn't be. See what console.log says. So if you if you call just a name without parameters it will return the function object which is just information about the function. Functions in JavaScript are objects. Yeah so this just goes like hey whatever the subtracting that you called the variable subtract is a function named subtract add this. I don't see a difference there but there is a difference. We can look it up. Scoping stuff.. Don't worry about that. We'll probably be covering that later way later hopefully... For the third way. So for both of these we have to call the names that we assigned it right. Which is typically how you'd want to do it but there's a third way of doing it where you can just declare a function and have it run whenever the thing that's reading a code gets to that line to a.

****Evan:** **[00:16:41] What code editor do you use?

****Nikita:** **[00:16:42] This is visual studio code.

****Evan:** **[00:16:45] And you have it opens up Node in....

****Nikita:** **[00:16:50] No I type in Node but it's hooked into my regular terminal so it's the same thing.

****Nikita:** **[00:17:48] This why there's no stupid questions. Everybody looks things up all the time. That makes sense. We still have to.. We're just defining our parameters again. Since this is all encapsulated inside of the initial parentheses we thought it would be the equivalent of us trying to call. Subtract just by typing subtract. That won't actually execute the function you have to have the two parentheses and you can see it simply in my editor. This is a variable This is the function you probably won't be using this bottom one too much.

****Nikita:** **[00:18:55] Brian Davenport likes them a lot of is there rarely a need. There's rarely like a situation where you have to ask that function run at exactly that point that the interpreter gets to it. You don't have to worry about it. Just remember that there's three ways three main ways that you could write functions. But you'll primarily be one to writing one of those two ways. Any questions?

****Evan:** **[00:19:25] Yes, how do you pass.. of course It's about one that we'll be most likely to use. How do you pass the parameters of a.. When you're just going to go straight out and write return.

****Nikita:** **[00:19:39] That's a good question, I think we can pass I mean.. You know what, I don't think this will take

****Nikita:** **[00:20:31] The sort of thing to..

****Evan:** **[00:20:59] I hope this is running but it doesn't return. If I may go one color to the last ....

****Nikita:** **[00:21:07] It isn't doing anything?

****Evan:** **[00:21:08] Gives me this is running and it just console.logs out there just doing that for me.

****Nikita:** **[00:21:14] Console.log The return.

****Evan:** **[00:21:16] Of I got something had something.

****Connor:** **[00:21:37] Not even close.

****Evan:** **[00:21:40] So I commented out. I'll be right there. So it's running. I'm opening up this function with Node which is as you said you run javascript you know just like locally or you can copy that. And put that into browser. OK.

****Evan:** **[00:22:04] You can right?

****Nikita:** **[00:22:23] There is.

****Connor:** **[00:22:27] Oh.

****Nikita:** **[00:22:29] There are are they going backwards. Let's try. So yeah you can do it you pass it in the.

****Evan:** **[00:23:05] Oh I think I was missing the

****Nikita:** **[00:23:08] This is what it would look like.

****Nikita:** **[00:23:19] I'm browsing to see if it returns that or.. if it'll Set up the return.. Yes.

****Evan:** **[00:23:29] So wait I'm getting lost. We use the return... It's

****Nikita:** **[00:23:40] Oh the way I got it to show up in my terminal console is a console logs. This whole thing. So that's why I had an extra parentheses. Oh yeah because if I run this thing. Give us one. It'll give me 10.

****Connor:** **[00:24:02] If you divide zero will your computer explode?

****Nikita:** **[00:24:10] I think it'll say infinity. 10 times 0 is 0.

****Connor:** **[00:24:20] Anyway listen I work from 11-8 and not 9-6.

****Evan:** **[00:24:29] Nikita I thought you said 10 times 0 is 10.

****Nikita:** **[00:24:35] No I'm pretty sure it's 0 that's, that's the basic overview of functions. Like the three that we wrote out here probably aren't very practical to what you guys would be doing but we can. We can write functions to do all sorts of crazy stuff like know merchant calling you shouldn't do this. You can see how it can be used in the browser. So let's say they call you and they're like You know I want to change this button text or something like that. Right. Using JavaScript example using both.

****Nikita:** **[00:25:17] We can do.

****Evan:** **[00:25:17] StringReplace()?

****Nikita:** **[00:25:35] Well that wouldn't really be a function either. It's already built in. But what if they were like I want you to make this add to cart button stop working or something right. We could very easily do that for some of this stuff you may not know but it doesn't matter. Just so you can see.

[00:26:16] [At this point Jake realized he'd made a terrible mistake]

****Jake:** **[00:26:41] I was sitting at my desk working this whole time

****Kyle:** **[00:26:54] We just stopped talking about the different kinds of functions you can make.

****Nikita:** **[00:27:02] So here I'm just basically assigning the button to a variable and document created after all is a vanilla javascript thing to select stuff on the page here I'm telling it select the ID. That's what the pound sign means the ID that is form action adds to cart and that's correct elements for this right here. So that equals and that's how I'm selecting it. Don't have to worry about that. That's how I'm actually grabbing the button and if I decide and button and actually spits out what I selected the zero there is because it's like querySelectorAll() technically returns like a list of stuff and we just want the first one which is a zero indicates position zero which is position and makes sense. So there were many use out event listener which is another built in JavaScript thing. All it does is add an event listener and I can tell you what to listen for the hearing when I say click. And then now I'm going to write a function that's going to execute whenever this event happens. This is what we call the callback function because it happens it's kind of complicated but it happens not at the same time that this happens like this here I'm adding the event listener and I'm telling it what to do when that event is triggered because.

****Jake:** **[00:28:45] Do you mean like a Promise? I'm just asking.

****Nikita:** **[00:28:50] What a stupid question.

****Jake:** **[00:28:53] Kind of! I'm just trying to ask you man

****Nikita:** **[00:29:32] So like we execute.

****Evan:** **[00:29:35] What was undefined? When you saved it?

****Nikita:** **[00:29:41] Because I didn't really give it an output. It's just something that Chrome does, cause it always returns. Always it goes to the next line. So you don't have to worry about this, now if I if I told it to actually do something in return undefined you would probably be in red like this like it'll say hey you're trying to do something that I don't have access to or I don't know. There's no value associated with it. Does that make sense? This is kind of maybe too complicated an example.

****Evan:** **[00:30:15] Would you call the parantheses after the button.listener? That it was there with you also call those parameters.

****Nikita:** **[00:30:24] No. That's actually a good point. So we go back here and delete this line and forget this. So if we call and find there's more or less anonymous but whenever we actually invoke the function and pass and a and b to it or whatever you want to play with at that point they're arguments frankly they're the same thing as parameters. We just call them arguments at this point here a and b are parameters. Here are five and 10 hour arguments. Because if you if you're you're talking to somebody in your life. Yeah. You know I call my add function with the parameters five and 10. I don't know what you're talking about.

****Evan:** **[00:31:15] It is just the of the properties and the arguments of the function

****Nikita:** **[00:31:20] Past arguments to the function. Or whenever you create the function or define it these are parameters.

****Kyle:** **[00:31:32] You set parameters, but you give arguments?

****Nikita:** **[00:31:38] Yes, you don't have to have parameters either like you could just write a function that does some shit like. We can get it as complicated as we want it. Yes we can define variables here.

****Nikita:** **[00:32:19] And we don't have to put a return... You ought to be. Maybe if I do a return... I never called it that's why.

****Evan:** **[00:32:46] Console.log test er.

****Nikita:** **[00:32:53] Remember we have to put the parentheses there whenever we call a function regardless of whether or not we're gonna be passing arguments to it. We got one hundred and undefined and we got undefined because this doesn't actually return anything. So if we return false. Then we do another variable.

****Evan:** **[00:33:28] Would it be A + B.

****Nikita:** **[00:33:42] And we did console logs here we can change these variables around that are inside the function. It's all the same stuff. Now what if we tried to do so the assumption runs right. Or if we just try to console like a variable we could find inside of a function, you think that'd work?

****Kyle:** **[00:34:12] Because the A and B are defined in the function which local scope

****Nikita:** **[00:34:17] Ah, yeah. So anything you create in here if the use the var keyword will be scoped to inside of that function which is a good idea because if we did like if we just hit A and then B basically we're making these variables global So like let's do a = 0... So last basically it's it's bad to do this because if you're if you're working with something that has a lot of code and a lot of definitions and stuff you're going to be changing these for the whole application if you don't use the var keyboard or later const which you don't hae to worry about var always use var insteadof function... Does that make sense? Don't worry about any of the var stuff I just said you don't really have to remember that this is the whole the whole point is to get comfortable with functions.

****Jake:** **[00:35:38] How is it that you assign global variable to a.. what is it like an "app.let"?

****Nikita:** **[00:35:45] To an app?

****Jake:** **[00:35:46] Yeah Like if you're trying to call a different directory and you're trying to make it where that's a variable that you're calling right. So you don't have to keep calling it over and over again you're assigning a variable to it at that point.

****Nikita:** **[00:36:00] To a file?

****Jake:** **[00:36:00] Yeah to a file?

****Nikita:** **[00:36:03] You'd use it if you were trying to Node , you'd use module exports and you would export. You basically tell the file that you're trying to export like hey make yourself available and then you require it in the file in the other file where you're going to use it.

****Evan:** **[00:36:31] An example would be picking up on one of Brian's examples would be like just a straight HTML page that has fields. You know enter name Evan click a button says we get a prompt of one thing. Hello Evan.

****Nikita:** **[00:37:34] Sorry gonna have to write an actual formula.

****Nikta:** **[00:38:18] There's no submit button but we can make one real quick...

****Nikita:** **[00:38:58] And we wanted... What do you what do you want to do with it?

****Evan:** **[00:39:01] What do we do. So we can take whatever we put in there and then we'll just concatonate a hard coded message. Yeah. Yeah. So we have we have to get a function that we look for the input idea names.

****Nikita:** **[00:39:33] I'm going to use all because I know there is only one. I'm writing a second event listener? Do you want to happen whenever it's submitted like whenever we hit the submit button.

****Evan:** **[00:40:13] Well we'd actually like to go more and that was something in the name. I mean you submit and you'll get a pop up it just says a message that has your name.

****Nikita:** **[00:40:26] Yeah. So. OK. So we're actually just like the form and we're going to use the submit event to trigger instead of a click. You could do either one but since we already have the form we'll do it this way.

****Nikita:** **[00:40:51] And we tell it what to listen for and submit and tell it what to do. And then this the callback functions work is whatever you pass in to this function is the result of this. So in our case it would be the actual event. You can name whatever you want you'll see a lot of things it's just "e". I'd like to write out "event". So. Here we can do... We don't really even need this in there.

****Jake:** **[00:41:26] Oh I just got it. We're going to be like just like an alert or pop up.

****Kyle:** **[00:41:36] We could just just do console.log it Like it works or something to make sure it's doing anything.

****Nikita:** **[00:41:42] Yeah not that's a bad idea.

****Jake:** **[00:41:46] Yeah.

****Nikita:** **[00:42:03] Let's do console.log. we'll do string, what's the name, what can we do with the name? I got an idea.

****Kyle:** **[00:42:20] Did you mean to use T name for the querySelector?

****Nikita:** **[00:42:25] No that was a test. I think we want name.value. We'll see if this works and we can check to see if we got any errors. Yeah we do. This is not a function why though.

****Jake:** **[00:42:57] Dot inner HTML?

****Nikita:** **[00:42:57] No we fucked something up it's like. We're gonna do it a different way. It might be queryselector might working weird on an input we're going to do getElementByID and on here we're not going to do the pound sign because we already told it that it's going to be an ID.

****Jake:** **[00:44:01] On everything inside of that field. on the input.

****Nikita:** **[00:44:06] Shouldn't matter I'm just selecting the element I'm not selecting the value.

****Kyle:** **[00:44:09] Maybe that's why Bryan used that preventFall thing

****Jake:** **[00:44:38] Can also add a jQuery library in the header that is the cheat I can't do anything from scratch that's for sure.

****Kyle:** **[00:44:53] When I first found jQuery like the thing I hated most stuff was accordions. In the first place I worked all they used were accordians for everything.

****Nikita:** **[00:45:16] Google whatever we don't know or remember.

****Kyle:** **[00:45:16] You add the dot value to the end of the variable

****Nikita:** **[00:46:15] Yeah that's it, because I think dot value is a jQuery thing. Yeah that's why you don't leanr jQuery first... Parentheses but can you guess it's going to happen let me refresh this.

****Evan:** **[00:46:43] I want to look at the code again. So we have we have form like as far as HTML goes we have form and we hae test form. Then the first variable so we have to get them form first and then create a variable for the form. I don't understand the purpose of the first variable.

****Nikita:** **[00:47:10] To select the form.

****Evan:** **[00:47:12] And then we have another variable that gets the data inside of the form.

****Nikita:** **[00:47:18] The name yeah the name er the value.

****Jake:** **[00:47:22] You can have the same form like on your checkout page. They can use the same like form if it just have an I.D. or something like that but the same like input I.D. or input values. That way you can choose between billing or shipping address form.

****Nikita:** **[00:47:42] Forms are special in HTML. There's a bunch of different ways you can select it like we could have it actually submit something in the serialized form data and read it that way. This is just where we're selecting this whole thing because that's going to be fired in the event or submit. Now if we selected the button we can make the event click and set it to happen whenever we click on it. This is the form where you're going to submit so we select the whole form. Then we're going to select the whatever value is in this space. And then we're going to say we're going to add an event listener to the form that we just selected we're going to tell it on submit. You know do the stuff. Do you think this will work?

****Nikita:** **[00:49:16] So the first time it didn't work because.. Well does anybody know? It looked like this.

****Evan:** **[00:49:23] Because the variable is outside the function.

****Nikita:** **[00:49:28] Why would that not work? Why would it. So this is this is this is our code right now that's running here.. Why doesn't this work though? There's no.. I put in test right. This code ran but.

****Kyle:** **[00:49:51] Because of a default of submit is to have nothing?

****Nikita:** **[00:49:59] No we can get rid of this and it would still not work.

****Jake:** **[00:50:06] And the add outside of the function.

****Nikita:** **[00:50:09] Why does that matter?

****Jake:** **[00:50:15] Because the bracket closing things?

****Nikita:** **[00:50:18] So this this triggers on an event. Right. So javascript loads on page. Like whenever the code gets or so whenever you render this in the browser it goes.

****Nikita:** **[00:50:30] It reads this reads that that when you have the form it creates the form then it reads the script. This is where it's actually being assigned. So it says form is this which exists. Name is this which exists dot value. There is nothing in the value because the user cpuldn't possibly have typed anything in when the page was rendered initially.. That make sense?

****Connor:** **[00:50:57] Because it runs before anybody puts anything in there.

****Nikita:** **[00:51:01] Right, itruns like the javascript is there as soon as the page loads. So there's that can't be a value there unless you there can't be a value there. Which is why we have to actually select and define

****Evan:** **[00:51:14] Could you say that with document.ready.. This document Didn't jQuery we're talking jQuery would document.ready also do the same thing?

****Nikita:** **[00:51:25] What do you think? It wouldn't it wouldn't.

****Nikita:** **[00:51:30] What does document ready do?

****Evan:** **[00:51:32] It waits for the HTML to load.

****Nikita:** **[00:51:36] But our problem isn't that this element isn't loaded.

****Nikita:** **[00:51:39] It's that we're getting a user's input and then user's input is going to be there as soon as the page loads.

****Connor:** **[00:51:46] The same go. But there's I never said put anything in that box. Yeah.

****Nikita:** **[00:51:51] So what we need to do is wait until the user types something in and hit submit. Then we're going to see what's in there because we know at that point they hit submit. Yeah. Yeah. That was the.

****Connor:** **[00:52:06] There was no don't do until this happened to just do it.

****Nikita:** **[00:52:09] Yeah. So like this and it was doing exactly what we told it to because we told it to select whatever value is in this field. But whenever the code ran there was nothing in value. So it's not to this isn't like a loop or something like that. This runs once yeah.

****Evan:** **[00:52:29] Did you. Yeah.

****Nikita:** **[00:52:35] Now we submit this a million times and we're going to keep watching this see See we can do all sorts of crazy stuff with that. But this part is a function and that's what we're talking about right.

****Nikita:** **[00:52:56] Any questions? That make sense you guys want to do on your own?

****Nikita:** **[00:53:03] So what's with the syntax of a function like what do you what you absolutely need for there to be.

****Kyle:** **[00:53:17] I'll do it if you guys don't want to. There needs to be Function parentheses open curly brace, close curly brace semicolon.

****Nikita:** **[00:53:25] Yeah that's it. That's the function keyword. We already went over like you don't technically have to give it a name but you should. Arguments parameters and then curly braces.

****Kyle:** **[00:53:40] Then calling the function.

****Nikita:** **[00:53:44] I mean that's really yeah. I mean the it gets more complicated whenever you have like really really big functions or.

****Connor:** **[00:53:54] So what I'm interested in to is, you're saying you can call function a function as a parameter for a function as a parameter. So we can deal like essentially why don't calculators do more?

****Nikita:** **[00:54:22] This is algebra right.

****Nikita:** **[00:54:25] So let's get that function back we'll just do another console. Function Z... this is bad nobody will know what it does

****Connor:** **[00:54:47] I will almost certainly... Need to construct function Z.

****Nikita:** **[00:54:54] A comma B... Say return A + B. Just like before.

****Nikita:** **[00:55:12] Then what if we did another function x first string it'll take two parameters again a comma b but it's gonna return.

****Connor:** **[00:55:42] A times B.

****Nikita:** **[00:55:44] Yeah why not. A times B Then you know we're gonna call Z and we're going to give it a 10. No one we're gonna call it X. We're going to say. This actually make a little more sense if we assign to variables so let's do that.

****Nikita:** **[00:56:15] So we'll say variable Z equals function A B whatever same thing.

****Nikita:** **[00:56:32] And then we could say.. we'll just do.

****Nikita:** **[00:57:04] Wait hold on. A + B...

****Nikita:** **[00:57:19] I'm confusing myself. Define those.

****Evan:** **[00:58:53] Because you just want to let go. You're right. Yeah. Yeah I get to be X.

****Nikita:** **[00:59:02] I'm confused myself cause both of them. Like do math. Let's make it simple all right. We'll just have var Z always return. 10 whatever. So then we can do X Z 10 I think?

****Nikita:** **[00:59:42] Not a number

****Nikita:** **[00:59:48] So that. Yeah. That's the I would like to pass a function as a argument to another function you've already defined. Give us NaN for not a number. Because whenever we call Z without its parentheses it just gives us the function definition.

****Kyle:** **[01:00:08] Yeah but theoretically you can do more math for Z and do the math and then do the X.

****Nikita:** **[01:00:15] So let's let's take a step back and go back to the original one where we did the dollar math. I think we can conceptualize that Z let's call X.

****Nikita:** **[01:00:33] Z and 6 comma that's the first argument we're passing to X which is going to multiply two numbers and then will say call Z again say 1 and 5... Ninety six. So what this did is we know what X does. X takes two parameters and it multiplies them right. And the parameters we gave it is going to be whatever Z returns for 10 and 6 and with Z returns for 5 and 1.

****Nikita:** **[01:01:21] So 10 times six right now.

****Connor:** **[01:01:28] Z is ten plus six.

****Nikita:** **[01:01:30] Which is 16 and then six it would be 16 times six.

****Kyle:** **[01:01:39] That's right.

****Nikita:** **[01:01:41] You already did it? Yeah yeah yeah. So that's the example of math.

****Nikita:** **[01:01:52] And it can be like complicated.

****Connor:** **[01:01:59] Look at this amazing which I learned this alongside like algebra. You like how much easier algebra would be if I only thought it.

****Nikita:** **[01:02:08] They taught it to us where it was just like memorize this formula.

****Connor:** **[01:02:12] Yeah. But if I knew if I had context to learn things that you know this is why do you know like here's why it do these are.. Man..

****Nikita:** **[01:02:31] This is setInterval is a method that is built in note. It's also built in to the browser. So you call this anywhere basically at you give it a millisecond time which is here I have five thousand milliseconds in every five thousand milliseconds it's going to do something with the function keyword. So I wanted to do something I say function and all I'm doing is making sure my database doesn't go to sleep. By just clearing it.

****Evan:** **[01:03:03] What is a is just.

****Jake:** **[01:03:06] It selects the first thing.

****Nikita:** **[01:03:08] The first thing.

****Connor:** **[01:03:09] It does is like the second thing cause zero is one.

****Connor:** **[01:03:11] I just want you to know I'm listening

****Nikita:** **[01:03:25] Yeah I mean this makes sense right. I know it's math it's lame but it's like the purest kind of function you can get.

****Connor:** **[01:03:36] I wish this wasn't an hour limit. This was interesting. This was an interesting way to look at.

****Nikita:** **[01:03:41] And then you could you could even tell X to have like 10 parameters or 10 arguments you can take it and get crazy with it or you can assign each of these to a variable and then just pass those variables into x and it would do would give you the same results.

****Nikita:** **[01:04:00] So like if I said t equals this T was always gonna be 16 and if I said C equals this C is always going to be six. So then I can say I can write the same thing with less stuff. So it's like you're just saying T and then C. This is the equivalent of writing this.

****Connor:** **[01:04:59] I mean I'm just I'm frustrated that you made math interesting.

****Connor:** **[01:05:04] It's like why aren't you a teacher

****Nikira:** **[01:05:09] My girlfriend's a teacher, an english teacher. I didn't like math when I was in school either. It was really boring and I wanna learn these formulas for a reason.

****Connor:** **[01:05:18] Yeah the thing is I hate doing math for the sake of math and I love statistics. I got to take those numbers and make them mean something even if it was inconsequential but like that's the only math I did really well in statistics.

****Connor:** **[01:05:32] So we're actually solving an issue like we're trying to get information. This I like because when you get to you get some it's easier for me to understand. This is what we want and we have to tell it. This is what we want and we have to tell it like every individual step and we have to read it all up and tell it everything.

****Nikita:** **[01:05:56] I mean you could write this do you write this is an algebra equation like let us solve for x.

****Nikita:** **[01:06:06] Where.. You Get it. And there's other stuff about functions.

****Nikita:** **[01:06:22] Wanna talk about for loops or anything at all.

****Evan:** **[01:06:30] what's the best way to get into learning built-in vanilla JavaScript?

****Nikita:** **[01:06:31] Just doing it.

****Evan:** **[01:06:36] StackOverflow what you don't know what you're trying to do.

****Nikita:** **[01:06:38] Yeah there is docs like if you if you think you know like the the the method name that you're trying to call or like I'm pretty sure it's documented you know getElementsByClass.

****Nikita:** **[01:06:57] But you're not exactly sure how to type it out.

****Nikita:** **[01:07:10] You can look it up and it'll tell you. Oh getElements getElementByID

****Nikita:** **[01:07:15] Or you can have elementsByTagName and then you can go from there but it also depends on how how you learn best.

****Nikita:** **[01:07:30] You can read a book and then know something which I can't.

****Nikita:** **[01:07:41] Thinking of a really cool function that we can do.

****Jake:** **[01:07:43] How to scrape the credit card data.

****Nikita:** **[01:07:52] We can we can make a request to the BigCommerce API. Not very difficult. Write out code that does it.

****Kyle:** **[01:08:40] This just a variable you choose.

****Nikita:** **[01:08:43] The same thing as var. But it's immutable so I can't redefine HTTPS as something else. Let's do const request finds something equals. What is it going to take. We're going to need really like headers and credentials and stuff in order to authenticate so we'll say like config.

****Nikita:** **[01:09:56] Takes one one argument and then a callback function.

****Nikita:** **[01:10:09] Here's our first arguments we have conveyed and then we're going to write our callback function and this callback function is going to be the response it's going to have the response from the request in it to the actual data that BigCommerce is going to send back to us. Right. And do.

****Nikita:** **[01:10:33] Yeah so it was a response onFinish we canc check data is ... and we're going to run another function whenever that happens.

****Nikita:** **[01:11:10] Then we'll actually call it request.env and dot env is built into the HTTPS method I believe. All right let's go to the config real quick. Equals.

****Nikita:** **[01:11:45] We're going to make it an object which is what these parentheses mean and we're just basically is a good way of storing data. without having to use or soemthing don't worry about too much about that stuff too much. We're just doing this a sample.. I didn't see base 64. Well of course I will make it easy for us is that these credentials aren't sent plainly to the API. It gets encoded into base 64 and kind of like concatonated. We can see an example if we can find one. I called my store... Perfect.

****Nikita:** **[01:12:28] And if you've used postman before you only just punch in username and password as a token. But what really happens and we send it out like if I make a request to my store.

****Nikita:** **[01:12:41] And then we check the headers. You can see this.

****Nikita:** **[01:12:43] This is the actual thing that is sending which is your credentials encoded we're going to be because we need to pass this to our requests just like they're doing post for the method and think we can do headers we'll do.

****Nikita:** **[01:13:11] Posts would be just ah. This guy here. I mean it's written out for you here and we don't do usually. Depending depending on what language you're using or what library you're using to do this you may have to give it the HTTPS. But since it HTTPS.request is explicit that it is aH HTTPS it's going to put it in there for us. which is cool, we'll give it a path.. slash API slash V2. .What do we want to get?

****Everyone:** **[01:13:55] Orders orders.

****Nikita:** **[01:13:58] Because we can then we're gonna do.

****Evan:** **[01:14:59] Would it pass back the JSON?

****Nikita:** **[01:15:02] This is just where of what we're sending in the headers at the request of BigCommerce so this is the BigCommerce is going to read this. It's going to read these credentials to make sure that they're.

****Nikita:** **[01:15:15] OK for this store. Let's look at this path. And it's going to saying they're looking for JSON. So you can specify JSON or XML with V2. And it's also content type is also applicable whenever you're actually making a when you're actually sending information as well. Like if I want a bit in order. I mean I would tell our API in the header is the request that ham sending JSON.

****Evan:** **[01:15:51] We're accepting JSON What is accepting

****Nikita:** **[01:15:59] We expect JSON back

****Kyle:** **[01:16:16] Why do you ask. Why do we have to define what we're accepting?

****Evan:** **[01:16:21] I just didn't know what it was doing.

****Jake:** **[01:16:28] You don't always have to define it. In some ERPs Like Netsuite you have to define it.

****Nikita:** **[01:17:15] This is where we're console logging Just raw data. So it's giving us like a buffer of what computers read which is no good for us.

****Nikita:** **[01:17:25] So what we can do is save this to a variable we'll call it X equal first is going to be blank we're going to say onData.

****Nikita:** **[01:17:45] Whenever we start getting data back. Right now it'll be. X = data.. Like I've written this out before.

****Nikita:** **[01:18:38] So we have something going on whenever we start getting data. We're also going to do something whenever something like this is kind of like the this kind of reminds you of an event listener pattern where we tell it to do something when something happens. We don't really need to give it parameters here.

****Nikita:** **[01:19:17] You can just do we'll see if this will work why not you may want to... So this is JSON why don't we clean that up.. Clear and then.. it's stringifying it Right now this is returning it to us as a sting because we're telling it like X is a string because it's two quotes initially and then we're just adding to those quotes so we can parse this out and it won't error. But it might JSON.parse

****Nikita:** **[01:20:14] X we'll say like const final data equals but don't think this will actually look nice in a console right.

****Nikita:** **[01:20:32] Like now we can actually see a little bit better what's actually happening here and it's concatenated because I have so many stupid orders. We wanted to get like a specific order now. We'll just change the path and say like get order one hundreds run this one hundred or one hundred and although you have to know an order a number.. So now I got JSON and this is what BigCommerce responded with just now is this shit here. If we run the same thing in postman.

****Nikita:** **[01:21:22] We should get the exact same thing back.

****Nikita:** **[01:21:26] It just looks like it's in postman is the only difference let's double check ID being custom ID 14 for its the exact same thing.

****Evan:** **[01:21:39] So can we look at.. Essentially it's a get request? Is it explicitly being said that.

****Nikita:** **[01:22:03] This is what the default is. So you could do method get. And if you wanted to look it up you would look up what what kind of options request takes. Takes protocol hostname host family port. All this stuff. Oh look at that method is one of them defaults to get, but I didn't specify.

****Connor:** **[01:22:27] What about can we do a put? Can we just.

****Nikita:** **[01:22:36] Like to create something?

****Nikita:** **[01:22:38] Yeah maybe a little more complicated because you have to write it to something.

****Evan:** **[01:22:44] What about a delete request? Can you delete an order?

****Nikita:** **[01:22:48] You can't delete orders in BigCommerce.

****Evan:** **[01:22:50] Can you change the order status?

****Nikita:** **[01:22:51] Yeah I can do that.

****Nikita:** **[01:22:52] Well why don't I show you like a fully written out one. So this is what you're talking about Jake module dot exports. You can think of these arrows as the function keyword. It's a different way of writing. But the important thing to remember here is that this takes a config and a payload versus. Whenever we wrote this it just took a config. So this doesn't take any user input. Like I can't tell this is what I want to write because it needs credentials to actually work. So this takes two things and arguments are optional so you can call this function without providing a payload in which case I have this if statement makes a check if the if a payload was provided then I know that I need to write something. So I say req or request right. And I write the payload assuming that it's properly formatted or Yeah. I mean it's way more complicated than just basic functions.

****Jake:** **[01:24:06] On this one right here. The one that you did hear when you put it I guess where it says headers. And then if you did a comma after the closing headers and then did a body and on that body you could. I think specify JSON data to make a PUT request method from get.

****Nikita:** **[01:24:32] There's no body here.

****Nikita:** **[01:24:34] I can is this because there is a built in method of Node so I can't just throw anything I want into the options that are at argument argument. It has to be one of these boys here

****Jake:** **[01:24:51] There's no data on it or..

****Nikita:** **[01:24:55] Yes. There is a specific way to do it. And they have examples in here. Here you can see that right. req.write See where they define req as a HTTP request with options.

****Nikita:** **[01:25:08] The same thing. And they req.write post data and post data is defined at the very top as message. So that's what they're actually writing. But I guess it is way too complicated for this for just basic functions you know. Yeah. But it is it is a real world example where we use functions to get shit done as they say.

****Nikita:** **[01:25:44] This really like the pattern is the same for all these are callback functions but so is these are the functions of call back functions. This this is a named function where I gave it when I call it a price for what it was pretty easy a piece of cake.