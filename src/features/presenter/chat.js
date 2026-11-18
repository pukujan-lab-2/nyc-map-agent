export function createChat(sessionId) {
  const jsonHeaders = {"Content-Type":"application/json",...(sessionId?{"x-session-id":sessionId}:{})};
  let venue = "";
  let weatherPlace = "";
  let awaitingVenue = false;
  let awaitingWeatherPlace = false;
  let lastTopic = "";
  const history = [];
  const places = [
    {pattern:/\b(?:new york city|new york|nyc)\b/i,name:"New York City"},
    {pattern:/\bunion (?:square|sq)\b/i,name:"Union Square"},
    {pattern:/\bcortlandt(?: street| st)?\b/i,name:"Cortlandt Street"},
    {pattern:/\bqueensboro plaza\b/i,name:"Queensboro Plaza"},
    {pattern:/\b(?:fulton street|fulton st)\b/i,name:"Fulton Street"},
    {pattern:/\bmanhattan\b/i,name:"Manhattan"},
    {pattern:/\bbrooklyn\b/i,name:"Brooklyn"},
    {pattern:/\bqueens\b/i,name:"Queens"},
    {pattern:/\b(?:the )?bronx\b/i,name:"The Bronx"},
    {pattern:/\bstaten island\b/i,name:"Staten Island"}
  ];
  const weatherIntent = /\b(?:weather|temperature|forecast|raining|rainy|sunny|how (?:hot|cold|warm))\b/i;
  const venueQuestion = /\b(?:where (?:are we|am i)|where (?:are we|am i) presenting(?: today)?|what (?:event|venue|conference) (?:is this|are we at|am i at)|which (?:event|venue|conference)|where is (?:the |this )?(?:event|demo|conference))\b/i;
  const venueStatement = /^(?:we(?:'re| are)(?: presenting)?|i(?:'m| am)(?: presenting)?|the (?:event|demo|conference) is|our (?:event|demo|conference) is)\s+(?:at|in|called)\s+(.{2,100}?)\s*[.!]?$/i;
  const greeting = /^(?:hi|hello|hey|good (?:morning|afternoon|evening)|how(?:'s| is) it going|how are you|how (?:are you|u) doing|how(?:'s| is) your day|how do you do|nice to meet you)(?:\s+(?:design baker|baker|moon))?[.!?\s]*$/i;
  const continuation = /^(?:why|how|what do you mean|tell me more|really|and then|what about that|can you explain|what else|what about it)[?.!\s]*$/i;
  const navigation = /\b(?:show|open|play|watch|take me|go|back|resume|continue|keep going|next|skip|start|jump|return|walk|tour|tell|explain|what|why|how|who|where|when|can|could|would|does)\b/i;
  const walkPosition = /\b(?:on|in) (?:the |this |our )?(?:walk|route|map|trip)\b/i;
  const pendingResponse = words => words.length < 100 && !navigation.test(words) && !/[?]/.test(words) && !weatherIntent.test(words) && !greeting.test(words);
  const clean = value => value.replace(/[’]/g,"'").trim().replace(/\s+/g," ");
  const save = (question, answer) => {
    history.push({role:"user",content:question.slice(0,300)},{role:"assistant",content:answer.slice(0,500)});
    if (history.length > 6) history.splice(0,history.length - 6);
  };
  const getPlace = words => {
    const found = places.find(place => place.pattern.test(words));
    return found?.name || "";
  };
  const explicitOtherPlace = words => /\b(?:weather|temperature|forecast|raining|rainy|sunny|how (?:hot|cold|warm)).*\b(?:in|at|for)\s+([a-z][a-z .'-]{1,50})/i.test(words);
  async function localReply(answer,label="Design Baker") {
    return {answer,label};
  }
  return {
    matches(words) {
      words=clean(words);
      return greeting.test(words) || weatherIntent.test(words) || (venueQuestion.test(words) && !walkPosition.test(words)) || venueStatement.test(words)
        || ((awaitingVenue || awaitingWeatherPlace) && pendingResponse(words))
        || (lastTopic === "conversation" && continuation.test(words));
    },
    async ask(words, {signal} = {}) {
      const text=clean(words);
      const venueMatch = text.match(venueStatement);
      if (venueMatch) {
        venue=clean(venueMatch[1]).slice(0,100);
        awaitingVenue=false;
        lastTopic="venue";
        return localReply(`Got it. You said the event is at ${venue}. I’ll remember that during this visit.`);
      }
      if (venueQuestion.test(text) && !walkPosition.test(text)) {
        lastTopic="venue";
        if (venue) return localReply(`You told me the event is at ${venue}.`);
        awaitingVenue=true;
        return localReply("I don’t know the event venue yet. Where is it?");
      }
      if (awaitingVenue && pendingResponse(text)) {
        if (/^(?:i (?:don'?t|do not) know|not sure|unknown|skip|never mind)$/i.test(text)) {
          awaitingVenue=false;
          return localReply("That’s fine. We can keep going without it.");
        }
        venue=text.slice(0,100);
        awaitingVenue=false;
        lastTopic="venue";
        return localReply(`Got it. You said the event is at ${venue}. I’ll remember that during this visit.`);
      }
      if (weatherIntent.test(text) || (awaitingWeatherPlace && pendingResponse(text))) {
        let place=getPlace(text);
        const other = !place && explicitOtherPlace(text);
        if (other) {
          awaitingWeatherPlace=true;
          return localReply("I can check current weather for New York City and nearby boroughs. Which place would you like?");
        }
        if (!place && weatherIntent.test(text) && !/\b(?:in|at|for)\s+[a-z]/i.test(text)) place=weatherPlace;
        if (!place) {
          awaitingWeatherPlace=true;
          lastTopic="weather";
          return localReply("Which New York City location should I check?");
        }
        weatherPlace=place;
        awaitingWeatherPlace=false;
        lastTopic="weather";
        if (location.protocol !== "http:" && location.protocol !== "https:") return localReply("Live weather needs a network connection.");
        try {
          const response=await fetch("/api/presenter/weather",{method:"POST",headers:jsonHeaders,body:JSON.stringify({place}),signal});
          if(!response.ok) throw new Error("Weather unavailable");
          const result=await response.json();
          if(typeof result.answer!=="string") throw new Error("Invalid response");
          return {...result,label:"Design Baker · Live weather"};
        } catch(error) {
          if(error.name==="AbortError") throw error;
          return localReply("I couldn’t reach the weather service. Please try again.");
        }
      }
      lastTopic="conversation";
      const fallback=greeting.test(text) ? "Hello! I’m Design Baker. I can guide you through the station walk or explore a question with you." : "I’m here with you. You can ask about the walk, the evidence, or the project.";
      if(location.protocol!=="http:" && location.protocol!=="https:") {
        save(text,fallback);
        return localReply(fallback,"Design Baker · Prepared");
      }
      try {
        const response=await fetch("/api/presenter/chat",{method:"POST",headers:jsonHeaders,body:JSON.stringify({question:text,history}),signal});
        if(!response.ok) throw new Error("Chat unavailable");
        const result=await response.json();
        if(typeof result.answer!=="string" || !result.answer.trim()) throw new Error("Invalid response");
        save(text,result.answer);
        return {...result,label:"Design Baker · Live"};
      } catch(error) {
        if(error.name==="AbortError") throw error;
        save(text,fallback);
        return localReply(fallback,"Design Baker · Prepared");
      }
    }
  };
}
