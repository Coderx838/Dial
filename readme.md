# *Dial* 

*A little radio chat you ssh into. and  then you can talk to anyone worldwide via your terminal yeh(but , they also need to be on the radio tho)*

## *Why does this exist:*

(*Because somebody said "what if there can be a radio where strangers can talk" and nobody stopped them.*)

(*And also cuz the [Crescent's multiplayer card](https://crescent.hackclub.com/guides/multiplayer) gave me a new reason for creating my this long envisioned project.*)

## *How it works:*

*Your terminal connects over ssh, and boom you are in a terminal where you can talk to anybody worldwide just radio and you*

*As you change through frequencies there are few things to mind:*
- Someone can only read message from people on same frequency they are.
- If you are close enough to a frequency where people are talking, you can see their messages, but they will be jumbled with distortion.
- The message doodle of a person turns green in message indicating that you are on same frequency as that person is. 
- yeh that's all now go try yourself.

## *Try it(yay!!):*

```
ssh -p 3453 2a01:4f9:3080:3192::1994
```

(*this is a public server, but you can always host your own copy of it, yeh really its here in this repo itself.*)


## *Screenshot:*


![alt text](image.png)
(*this is for your welcome!!*)


![alt text](image-1.png)
(*yeh this is how it looks*)


## *Run your own server:*

(*Note: following commands are given assuming your operating system to be windows, if you are using other operating system they may not work as is.*)

*clone the repo (yeh i know you know how to do this) and i hope node is alredy downloaded on you machine(yeh really hope so), if not get it from [here](https://nodejs.org/en).*

*then run this both commands one by one in your local copy of repo*

```
npm install
```
```
npm start
```

-> *be happy now you have the server running on your localhost  port 2222(default)*

(*set variables DIAL_HOST="::" , PORT=3453 in the terminal for exposing it on public ip or another port if needed.*)

Example : 

```
set DIAL_PORT=3333
node server.js
``` 

*For testing after running local server use following command to connect to it:*

```
ssh -p 2222 localhost
```

(*if you used any other port use that to connect to the server*)

## *Commands*

| command | what it does |
|---|---|
| `←` `→` | turn the dial. find people. |
| `/freq 98.5` | teleport to a frequency |
| `/who` | who's on air near you |
| `/theme chalk` | parchment, pad, chalk, blueprint |
| `/doodle 3` | change your little face |
| `/name sam` | change what people call you |
| `/help` | all the commands you need to know about in-chat. |
| `/quit` | go off air |

(*there are more command you can know about it using /help in the chat.enjoy!!*)

(*AI usage note: AI is only used in debugging when i lose my mind due to a bug , except for this and some nest server lag problem , AI is not used anywhere else.*)

(*there are some easter eggs in the chat , hunt for them*)


-----------------------------------------------------------------------------------------------------------------------------------------

Made by a teen for [hackclub ysws](https://crescent.hackclub.com/).