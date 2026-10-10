# Kickoff talk transcript, 2026-10-10 09:30

Recorded by Oriol at the welcome talk. Automatic transcript, unedited. Speaker 1 is first the Dwelly host, then Ashley (Anthropic Applied AI, London). "Core 30" is a mis-transcription of "16:30", the Reality Test.

---

Speaker 1: And the real metrics are how the customers experience the service itself. So, welcome—welcome to the hackathon. Super excited to see you here.
Speaker 1:  You'll be working on real, kind of, world problems, not just like chatbots or something. Something that touches life, something that reimagines kind of the workflows, something that reimagines how real, real kind of things happen in the world.
Speaker 1:  Welcome, and good luck.
Speaker 2:  Whoo!
Speaker 1:  Next part about the rules. So we will have, uh, 14 insurance claims, property management, banking service, and delivery logistics. Everyone already picked one, um, previously.
Speaker 1:  So, um, we will provide synthetic data in 20 minutes. It will be, uh, it will be in, like, here in the hacker guide.
Speaker 1:  You all have this here too. So you can use any style.
Speaker 3:  Are you done?
Speaker 1:  You can use any language, any technology—
Speaker 3:  Yeah, but they're running late because they had the tube delay. Sorry about that.
Speaker 1:  And you need to solve, uh, our, like, complicated synthetic data. We will solve one for the— So, uh, what is the real matter? Most important thing: you need to build the AI agents to solve real problems.
Speaker 1:  So the best way is if you can go tomorrow to some industry company and just solve your solution to them. It's mass-generated.
Speaker 1:  It must work with emails, maybe calls, maybe something. But, uh, it not must only solve our synthetic data.
Speaker 1:  It will be complicated. Um, what makes it a difference?
Speaker 1:  So, um, in 20 minutes we will introduce you to our, like, synthetic data. It's something you can use to just, uh, work with this to, like, solve and understand what will be in Core 30.
Speaker 1:  In Core 30 will be, like, complex, uh, synthetic datas with a complex task, with a something unusual, something that's really going in real life. Because in real life sometimes everything is broken, and that's what we'll be doing.
Speaker 1:  And, uh, yeah, uh, like, most important: have fun, build real-world solutions, and use a lot of AI agents. And please welcome Ashley from Anthropic.
Speaker 2:  How are you doing?
Speaker 1:  All right. Welcome, everyone. Hope you're excited for today.
Speaker 1:  I for sure am. My name is Ashley.
Speaker 1:  I'm part of the Anthropic team in London, and I sit in the applied AI team that works specifically with scholars. So my day-to-day is working with engineers like yourself on really cool problems that they're trying to solve with AI.
Speaker 1:  So I like to think it's a really cool job. Um, so who here has built an AI agent before from scratch?
Speaker 1:  I'm sure of fans. Okay, good.
Speaker 1:  Most of you, so talking to the right group. Uh, what I'm going to do today over the next 10 to 15 minutes is just cover some of the basics of what really is an AI agent, what are the recommendations we should use, how can we use tools to build it, and just comment if it falls to, uh, the worth.
Speaker 1:  And we're also going to look at, uh, what I can do for demo only, of several AI agents doing cool things on a lunar base, which isn't what we're building today, but that's important. Who knows?
Speaker 1:  It might come to us. So let's get started.
Speaker 1:  So in, in simple words, what is an AI agent? I, I like to just call it and define it as an agent loop, where your job is to create the boundaries of what this AI can and cannot do and how to do it.
Speaker 1:  Uh, but then it kind of uses its own judgment each time. In, in, in this loop, it'll understand what the context is in that specific scenario.
Speaker 1:  Say, this is a call to book an appointment. So that's the context.
Speaker 1:  It'll gather context. It'll gather more context.
Speaker 1:  It has a really good task, and it has many tools to use those. Those tools could be read and write into a software like Salesforce, or those tools could actually be other really good options.
Speaker 1:  And then the loop is where the agent does all the work, where it's working autonomously without your active guidance. You just set the rules and guidance for the short time, and then the agent is on its own.
Speaker 1:  And then it has several decisions. It can just take the action directly.
Speaker 1:  In many cases, you'd want a human in the loop involved, where it asks you for permission to do something before it does it. And, uh, it verifies the action once it's done, and then you get the final result.
Speaker 1:  So these are just pretty basic things that, uh, resonate with everyone. I, I want to go one step deeper into what really makes an AI agent, what really makes a loop work.
Speaker 1:  These are the five permitted things that are really important. First is instructions, which is essentially, in some ways, this is the problem of your AI agent.
Speaker 1:  This is, this is something in simple English you're telling your agent who it is, what's its purpose, roughly what it should do, how to, how it should act, etc., etc. This, this is what essentially makes, at a base level, your AI agent very different from someone else.
Speaker 1:  Even if you don't have any others, just having a system prompt will make your AI agent very different than someone else's, even if you're using the exact same model, exact same, uh, sandbox, etc. But how do you make your AI agent more special?
Speaker 1:  How do you make it more secure? How do you make it faster?
Speaker 1:  How do you make it more effective and a better user experience and more predictable? If that's what you want, those are the other permitted things.
Speaker 1:  So there are tools. Hopefully most of you have used them.
Speaker 1:  So essentially, it's going to be simple Python functions that you're defining as actions that the agent can do when it needs them, when it thinks, uh, it should be able to do. So the agent is using its judgment of when to use what tool, but it is your job to write a good tool in that situation.
Speaker 1:  Then skills, something hopefully you're all using in your tools of yours. Essentially, runbooks of instructions.
Speaker 1:  Uh, and you can't give all the instructions upfront in the system prompt, otherwise it gets too long. That's why you have skills.
Speaker 1:  So it selectively uses certain skills in certain situations, and just add a collection of skills in the background. And then there are some other things, like permission and hooks.
Speaker 1:  There are really good security features. If there are certain tool use cases that are irreversible, maybe you want to add a hook before that tool use, so that maybe that's a human in the loop hook.
Speaker 1:  And that's, um, one way to make sure that your agent is super secure. And the last one is structured output on, uh, defining exactly what the output should be.
Speaker 1:  If you always want it in a JSON form so it goes into another system, structured outputs are really important. So a few things, uh, Claude does for you.
Speaker 1:  I just want to call that out because there is actually a lot it can do for you, so you don't need to build everything from scratch. So take advantage of things that are already just available out of the box.
Speaker 1:  So things such as scanning, uh, pictures or documents, things such as that. I think at this stage you probably won't benefit much from building your own ACR, uh, OCR setup.
Speaker 1:  Like, these are things that just come with Claude. So let the model do that and focus on building around it.
Speaker 1:  I think another thing, uh, Claude can do for you is, uh, run simulations of different agents when you want to try different setups. If you can give it a clear goal, if you can give it, say, 10 examples of, "Hey, these are the questions and the answers I want you to achieve.
Speaker 1:  This is the starting harness. I want you to think plan until you get a 10 on 10."
Speaker 1:  It can do that for you. So that's an easy way on how to optimize your prompt, your tool use, etc.
Speaker 1:  And, uh, uh, last thing is, as I'm sure most of you are doing, use Claude to build itself. Claude has really good knowledge in its own ways about tool use, how to design good tests, etc.
Speaker 1:  But one thing I found especially useful is if you can also always ask it to check, uh, the latest Claude, uh, code docs. It does a much better job because best practices are changing every week.
Speaker 1:  So definitely use Claude to do a lot of the work on your behalf and act as, uh, act as someone that's guiding you.
Speaker 1:  Thanks. And just last thing I wanted to touch upon before we go into the demo.
Speaker 1:  Uh, these are some common pitfalls I've seen, uh, people get into and then end up wasting a lot of time, or they don't realize, uh, until the end that, uh, they over-optimize their tool for specific use cases and it doesn't generalize well. So I think the first thing to do is, or the first thing you should do, is design your test suite.
Speaker 1:  What do I mean by test suite? It's a handful of questions and answers that, uh, you want to test every time you're making a significant change, uh, to your code.
Speaker 1:  This is really important because you might only look at one example and you make a change and it works a bit better and you're happy, but it might, uh, regress on, like, two or five other cases. And it's really hard to know.
Speaker 1:  Uh, AI agents can't behave in unpredictable ways. So always have your sample of questions that you want to test against for every change.
Speaker 1:  This will save you a lot of time, um, going forward. And another common mistake I see people making is always testing as what we call the happy path.
Speaker 1:  Like, easy use cases, uh, that might work on your testing environment, but it might surprise you in a real world where the actual data is really messy. And I think the happy path today is designed, uh, in that manner as well.
Speaker 1:  And then the last thing is, uh, make sure, especially when you're designing tools, that if they crash, that your AI agent knows about it and knows about it in a timely manner. I see many sort of endless loops where an AI agent is stuck waiting for a tool output, and it's either stuck somewhere, it's taking too long, and the AI agent just doesn't know.
Speaker 1:  So have appropriate guardrails in here. Maybe set a timer that if the tool time runs out, the agent gets the output back so that the AI agent can then understand, "Should I not run this tool?
Speaker 1:  Maybe I should run it in a different way." Uh, you want most of the power to be at your AI agent, not with all of the other things you're building around it.
Speaker 1:  So that's about it. Um, I want to spend a few minutes showing some permitted things in, uh, a demo I've put together.
Speaker 1:  So give me a second. All right.
Speaker 1:  Here it is. So this is, uh, our fictional, uh, uh, lunar base called Taiko Base.
Speaker 1:  Each, uh, each building here essentially serves its own purpose. Uh, this is a good, hopefully fun representation of what different tool use can be, what different knowledge, knowledge bases can be.
Speaker 1:  So here we have the greenhouse. Um, we have a skate.
Speaker 1:  This will be relevant in an example coming forward. Then we have the command center.
Speaker 1:  So this is where all the skills are stored. We have, uh, the med bay again, another repo of, uh, different information.
Speaker 1:  And then we have a comms unit, which, you know, in, in real world you can think of as a tool use that actually sends a message to a final customer. So let's, let's, uh, let's play around with it.
Speaker 1:  Uh, in the first case, let's see, should we stop?
Speaker 1:  Give me a second. Oops.
Speaker 1:  You know what? We will, uh, um, but I think, uh, I, I hope the permitted things that I've told, uh, at the start, it's really, in some ways, very simple.
Speaker 1:  Like, those are all the permitted things you have to work around with, but how you put them together tastefully with your own craft and generative is, is what matters. Um, I would say in hackathons two, two years ago, eight hours was a very stressful time.
Speaker 1:  You know, you're writing a book by hand. It's very tough to find, build something meaningful in, you know, six, seven, eight hours.
Speaker 1:  Today that's completely shifted. You know, even one person with few hours can build a working prototype.
Speaker 1:  Uh, but the bar has also shifted. That's not, that's not going to be good enough.
Speaker 1:  So I would really suggest you to take the time to think deeply about what you want to build, what is the problem statement, what can you do better than someone else, and then start building and then validate it and keep testing against different cases, against edge cases. Focus on security.
Speaker 1:  Um, focus on the user experience, the final user delight as well. And maybe the end goal should be, "Whatever you build today, that's something you can actually take to a business tomorrow and, uh, and sell it."
Speaker 1:  So with that, thank you so much. Uh, all the best, and I'll be here to do anything.
Speaker 1:  Thanks.
Speaker 2:  Thank you, Ashley. So right now you will receive, uh, to your email links to, like, credits for Anthropic and other labs. Uh, if you have any questions or you don't receive the links, please, uh, go to this table.
Speaker 2:  Uh, there will be our team who will help you. Also, I know, like, few people, few people here right now, uh, not sure if they're in the right table.
Speaker 2:  So if you have questions about the team, about the something, also please, uh, come to us and we will help you. Uh, repository with synthetic data, uh, in this link, uh, it's already open.
Speaker 2:  And also, any questions, please ask. Good luck, and let's start building.
Speaker 3:  Is it cool if we, if we start?
Speaker 4:  Uh, yeah, I'm waiting for my teammates because they're late. So there's probably four more.
Speaker 5:  Sorry, do you still want to wait for your team?
Speaker 4:  Yeah, yeah.
Speaker 5:  Yeah? Okay.
Speaker 4:  They're all coming, but they're just all late.
Speaker 5:  Okay. But just in case you don't have a team, we can, like, shuffle you around.
Speaker 4:  Okay, perfect. Thank you. I'll let you know.
Speaker 4:  How's it going, man? Good to see you.
Speaker 6:  Silly hamster.
Speaker 4:  Yeah.
Speaker 6:  Okay, man.
Speaker 4:  How's it going, man?
Speaker 6:  Nice to meet you.
Speaker 4:  Nice to meet you.
Speaker 6:  How are you?
Speaker 4:  Pretty good. Pretty good.
Speaker 6:  Nice.
Speaker 4:  I was just, like, briefing the idea a little bit just to get a better understanding.
Speaker 4:  Oh, also, I've recorded the whole.
