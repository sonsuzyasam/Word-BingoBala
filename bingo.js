'use strict';

(function(){
  const cm = v => v * 28.3464567; // cm → pt

  // PDF fontları
  let FONT_TEXT = 'helvetica';
  let FONT_NUM  = 'helvetica';

  const ready = fn => (document.readyState==='loading'
    ? document.addEventListener('DOMContentLoaded', fn)
    : fn());
  ready(init);

  function init(){

    /* ===== Helpers ===== */
    const hexToRgb = (hex, fb=[255,122,0])=>{
      const m = String(hex||'').trim().match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
      return m ? [parseInt(m[1],16),parseInt(m[2],16),parseInt(m[3],16)] : fb;
    };
    const transliterate = s => s
      .replace(/İ/g,'I').replace(/ı/g,'i')
      .replace(/Ş/g,'S').replace(/ş/g,'s')
      .replace(/Ğ/g,'G').replace(/ğ/g,'g')
      .replace(/Ç/g,'C').replace(/ç/g,'c')
      .replace(/Ö/g,'O').replace(/ö/g,'o')
      .replace(/Ü/g,'U').replace(/ü/g,'u');

    function fitTextToWidth(doc, text, maxW, maxChars=36, minSize=8, maxSize=12){
      let t = (text||'').trim();
      let size = maxSize;
      // Önce tek satırda sığdırmayı dene
      while(size >= minSize){
        doc.setFontSize(size);
        if (doc.getTextWidth(t) <= maxW) return {lines:[t], size};
        size -= 0.5;
      }
      // Tek satırda sığmıyorsa, kelimeyi iki satıra böl
      let best = {lines:[t], size:minSize};
      if (t.indexOf(' ') > 0) {
        let words = t.split(' ');
        let found = false;
        for (let i=1; i<words.length; i++) {
          let line1 = words.slice(0,i).join(' ');
          let line2 = words.slice(i).join(' ');
          doc.setFontSize(minSize);
          let w1 = doc.getTextWidth(line1), w2 = doc.getTextWidth(line2);
          if (w1 <= maxW && w2 <= maxW) {
            best = {lines:[line1,line2], size:minSize};
            found = true;
            break;
          }
        }
        // Hiçbir bölme noktası bulunamazsa, kelimeyi ortadan ikiye böl
        if (!found && words.length > 1) {
          let mid = Math.floor(words.length/2);
          let line1 = words.slice(0,mid).join(' ');
          let line2 = words.slice(mid).join(' ');
          best = {lines:[line1,line2], size:minSize};
        }
      }
      return best;
    }

    async function tryLoadUnicodeFont(doc){
      const candidates = ['fonts/NotoSans-Regular.ttf','fonts/DejaVuSans.ttf'];
      for(const url of candidates){
        try{
          const r = await fetch(url, {cache:'no-store'});
          if(!r.ok) continue;
          const buf = await r.arrayBuffer();
          const b64 = await new Promise(res=>{
            const fr = new FileReader();
            fr.onload = () => res(fr.result.split(',')[1]);
            fr.readAsDataURL(new Blob([buf]));
          });
          doc.addFileToVFS('Uni.ttf', b64);
          doc.addFont('Uni.ttf', 'Uni', 'normal');
          FONT_TEXT = 'Uni';
          FONT_NUM  = 'Uni';
          break;
        }catch(_){}
      }
      try{
        const r = await fetch('fonts/DejaVuSans-Bold.ttf', {cache:'no-store'});
        if(r.ok){
          const buf = await r.arrayBuffer();
          const b64 = await new Promise(res=>{
            const fr = new FileReader();
            fr.onload = () => res(fr.result.split(',')[1]);
            fr.readAsDataURL(new Blob([buf]));
          });
          doc.addFileToVFS('UniBold.ttf', b64);
          doc.addFont('UniBold.ttf', 'Uni', 'bold');
        }
      }catch(_){}
    }

    const unitWords5 = {
      unit1: [
        "English","Turkish","Maths","Science","Social Studies","Art","Music","Physical Education","Drama","Religion and Morals","Computer","History","Geography","French","German","Spanish","ICT","on Sunday","on Monday","on Tuesday","on Wednesday","on Thursday","on Friday","on Saturday","bad at","good at","dislike","hate","like","love","enjoy","learn language","play","solving problem","speak","study","How many","How old","Which","When","Where","Who","age","5th grade","6th grade","7th grade","8th grade","middle school","primary school","secondary school","best friend","class","classmate","country","deskmate","family","favourite","friend","guitar","language","nationality","number","only","surname","that is","this is","timetable","Good bye","Great","Hi","How are you","I’m OK","Me too","Nice to meet you","Not bad","Not really","See you","You are welcome","What’s your favourite","What’s your favourite class"
      ],
      unit2: [
        "at","behind","between","in front of","in","near","next to","on the left","on the right","on","opposite","under","go straight ahead","take the first right","take the second left","turn left","turn right","are there","excuse me","hi","I’m sorry","is there","not at all","see you","thank you","there are","there is","where","you are welcome","bakery","bank","barber’s","bookshop","bridge","bus station","bus stop","butcher","chemist’s","florist","green grocer","grocery","hospital","house","library","mosque","museum","neighbourhood","pharmacy","playground","police station","post office","road","shop","stationery","street","swimming pool","theatre","toy shop"
      ],
      unit3: [
        "play football","listen to music","read book","do puzzle","swing","paint","run","walk","eat","help","want","learn","find","play marbles","play tag","draw","watch","take photos","like","love","live","game","outdoor games","blind man’s buff","hide and seek","dodge ball","skipping rope","see saw","hopscotch","hula hoop","board games","puzzle","backgammon","jigsaw puzzle","checkers","taboo","chess","hangman","scrabble","origami","cartoon","free time","leisure time","spare time","with","can","easily","difficult","always","usually","sometimes","never","great idea","fun","boring","interesting","enjoyable"
      ],
      unit4: [
        "wake up","get up","wash face","brush teeth","comb hair","get dressed","have breakfast","go to school","study","have lunch","do homework","play games","watch TV","have dinner","go to bed","sleep","tidy room","visit grandparents","read book","listen to music","ride bike","walk","run","draw pictures","help mother","leave home","arrive at school","get on the bus","come back home","take a shower","take a nap","go online","go shopping","eat","drink","talk","say","feel","want","need","start","finish","before school","after school","in the morning","at night","on weekdays","on weekends","every day","every week","every month","always","usually","often","sometimes","rarely","never"
      ],
      unit5: [
        "ill","sick","fever","headache","toothache","stomachache","cold","cough","sore throat","backache","feel bad","feel good","feel tired","feel sleepy","feel energetic","go to doctor","take medicine","drink water","stay in bed","rest","get well soon","what’s the matter","how do you feel","I feel bad","I feel good","I have a headache","I have a fever","you should","you shouldn’t","don’t worry"
      ],
      unit6: [
        "movie","film","cinema","actor","actress","director","cartoon","comedy","drama","horror","science fiction","action","romantic","adventure","watch a movie","go to cinema","buy ticket","popcorn","seat","screen","trailer","scene","character","funny","scary","boring","exciting","interesting","sad","happy"
      ],
      unit7: [
        "party","birthday","invitation","invite","guest","balloon","cake","candle","gift","present","decoration","music","dance","game","surprise","celebrate","have fun","make a wish","blow out candles","cut the cake","open presents","wear party hat","send invitation","thank you","you’re welcome","happy birthday","best wishes"
      ],
      unit8: [
        "fitness","exercise","workout","gym","run","walk","jump","stretch","lift weights","do yoga","do pilates","ride bike","swim","play sports","football","basketball","tennis","volleyball","healthy","strong","fit","active","energy","body","muscle","heart","lungs","bones","eat healthy food","drink water","sleep well","stay fit","keep healthy"
      ],
      unit9: [
        "animal","pet","dog","cat","bird","rabbit","fish","turtle","hamster","parrot","feed","clean","wash","take care of","love animals","adopt","shelter","vet","cage","food","water","bowl","leash","collar","play with","walk"
      ],
      unit10: [
        "festival","celebration","holiday","national","religious","traditional","New Year","Eid","Christmas","Thanksgiving","Halloween","Children’s Day","Republic Day","Victory Day","April 23","October 29","December 25","fireworks","parade","costume","mask","candy","gift","present","decorate","celebrate","visit relatives","send cards","eat special food","wear traditional clothes","have fun"
      ]
    };
    const unitWords6 = {
      unit1: [
        "arrive at school","arrive home","attend chess club","brush teeth","chat","clean","come back home","cook","do homework","do shopping","drink","drive","eat","feed","finish all homework","get dressed","get home","get out of the bed","get up","go online","go out","go shopping","go to bed","hang around","have a bath","have a busy weekend","have a rest","have a shower","have a snack","have breakfast","have dinner","have lunch","help parents","join","learn","leave home","leave school","live","make","meet friends","play game","play soccer","rest","ride bike","run errands","sleep","start","stay","study lesson","surf on the net","take folkdance course","take a nap","take a shower","take care of the pet","tidy room","visit relatives","wait","wake up","wash","watch","wear","work","would like to","write diary","about","after","because","before","but","here","me","there","until","us","well","with","how many","how much","how","what time","when","where","which","who","whose","why","always","at night","at the weekends","class","early","everyday","free time","in the afternoon","in the evenings","in the mornings","late","leisure time","never","often","on weekdays","rarely","sometimes","traditional","usually"
      ],
      unit2: [
        "bagel","baked beans","bean","bread","breakfast","butter","cake","cereal","cheese","croissant","cucumber","dinner","drink","fast food","food","fridge","fruit juice","grapes","healthy food","honey","jam","juice","junk food","lemonade","lunch","muffin","mushroom","olive","omelette","onion","pancake","rice","salami","salt","sausage","snack","soup","sugar","tea","toast","vegetable","buy","dislike","eat","enjoy","give","include","hate","have","like","love","make","mean","need","prefer","put","tell","think","want","after","before","about","but","because","with","a little","a lot of","any","baked","big","delicious","favourite","full","grilled","healthy","hungry","lots of","nutritious","some","special","thirsty","traditional","unhealthy","can I have","do you want","excuse me","it’s all gone","let’s","want","what type of","what kind of","would like","would you like","enjoy it"
      ],
      unit3: [
        "clean","climb mountain","compare","cook","cycle","draw picture","drive","feed the animals","find everything","get","give","grow vegetable and fruit","have a barbeque","help","join","knit","learn","leave","live","make cake","need","play soccer","prefer","prepare","put","read newspaper","rest","ride horse","set the table","spend","take","talk","visit","want","wash the dishes","water flowers","wear","work","would like","beautiful","better","big","boring","busy","cheap","cheerful","clean","cold","crowded","dangerous","easy","enjoyable","exciting","expensive","fast","fat","funny","good","handsome","happy","hard","hardworking","healthy","heavy","high","hot","ill","important","interesting","large","late","lazy","light","long","lovely","low","middle aged","noisy","nutritious","old","peaceful","pretty","quiet","ready","relaxing","safe","same","short","slim","slow","small","strong","tall","thin","tidy","very","warm","young","building","city life","city","country life","country","downtown","everybody","farm house","garden","high building","important exam","kiosk","library","neighbourhood","shop","shopping center","skyscraper","street","summer","thing","ticket","town","traffic jam","winter","are there","at the moment","everything","is there","nothing","now","right now","so","there are","there is","today","when","where","which","who","why","you are right"
      ],
      unit4: [
        "chilly","cold","cool","dry","fabulous","foggy","freezing","hailing","hot","lightning","lovely","pleasant","rainbow","rainy","snowy","spring showers","storm","stormy","sunny","warm","weather forecast","wet","windy","angry","anxious","bored","excited","fine","good","great","happy","moody","nervous","nice","sad","scared","sleepy","surprised","unhappy","well","boot","coat","flip flops","gloves","hat","jacket","jumper","raincoat","scarf","shirt","shorts","sunglasses","sweater","tee shirt","umbrella","average temperature","beach","desert","garden","grandparents","outside","parents","place","sky","snowman","temperature","today","tomorrow","early","first","greetings","late","let’s","really","second","third","very","with","you are right","feel","go sightseeing","look at","look for","look","make snowman","make","need","put on","rain heavily","rain","repeat","ski","snow","spend time","stay","swing","take","understand","want to","wear","how do you feel","how is the weather","how many","how","what is the weather like","when","where","which","who","why","spring","summer","winter","fall","monday","tuesday","wednesday","thursday","friday","saturday","sunday"
      ],
      unit5: [
        "fair","funfair","roller coaster","ghost train","ferris wheel","the house of funny mirrors","chairoplane","bumper cars","carousel","amazed","amazing","anxious","bored","boring","crazy","dangerous","dull","enjoyable","excited","exciting","fantastic","frightened","frightening","great","happy","horrible","nice","scared","sleepy","surprised","terrifying","thrilled","thrilling","upset","all","also","anything","both","everything","really","ride","sign","something","soon","thing","ticket","token","very much","agree","allow","buy","disagree","fasten seat belt","get on","hate","have a rest","love","like","say","sell","think","try","understand","visit","want","want to","I think","I agree","I don’t agree","I agree with you","I don’t understand","what do you think about","which","why","who","when","where","which one","what type of","what kind of","would you like"
      ],
      unit6: [
        "about","Actor","Architect","Baker","Barber","Businessman","Butcher","Cleaner","Cook","Dentist","ago","ask question","at present","become","bring food","build road, bridge and building","build","clean","concert","cook meal","cut fabric","cut hair","defend people at court","design","Doctor","draw plans of buildings","dream job","drive lorries","Driver","Engineer","Farmer","dye hair","examine patient","farm","Feel fine","Fireman","Gardener","free time","grow vegetables and fruit","Hairdresser","Housewife","Lawyer","job","last","look after ill people","make and sell bread","make dress","manage","Manager","Mechanic","meet","mend","repair","now","occupation","patient","people","person","Pilot","Tailor","place","President","Nurse","Policeman","primary school","pull out teeth","put","reach goal","repair cars","Retired","Scientist","Salesperson","Salesman","Saleswoman","sell clothes","serve food","sew fabric","Singer","Waiter","Waitress","Worker","still","take order","teach","tidy","was born","work","yesterday"
      ],
      unit7: [
        "ago","again","ancient city","beach","boat trip","castle","climb","different experience","different","diving","enjoy","everybody","everywhere","famous places","fishing","forest","fun","great","here","hiking","holiday","how long","how often","how","ice-skating","incredible","join","lake","last","last week","learn","live","make snowman","me too","mountain","movie","nature","nobody","paragliding","pick fruit","pick","rain","really","river","sailing","sand","scuba diving","seaside","sightseeing tour","skiing","somebody","somewhere","stay in a tent","study","summer","take","tent","there","tiring","try","two years ago","vacation","village","visit","walk in the forest","want","weather","when","where","which","who","why","winter","yesterday"
      ],
      unit8: [
        "basket","bed","bookshelf","calendar","clock","dictionary","e-book","fox","information","kite","lamp","library","magazine","newspaper","novel","painting","pillow","racket","school bag","story","teddy bear","toy","wall","watch","world map","behind","between","in front of","in","near","next to","on","over","under","answer","borrow","break","buy","call","come","do","fall","feel","find","give","go","happen","have","help","hurt","invite","leave","lend","look for","look up","lose","make","meet","organize","read","see","sing","study","take","visit","walk","worry"
      ],
      unit9: [
        "attend","cause","check","clean","cut down trees","cycle","damage animals habitat","destroy forest","destroy","die","do exercise","drive private cars","drive to work","forget","harm animals","hurry up","hurt animals","keep the sea clean","leave the tap on","live","make new farm lands","pick up","plant trees","plug","pollute water and air","pour waste","prevent pollution","protect animals","protect environment","recycle batteries","recycle litter","recycle paper, glass and plastic","reduce the use of electricity","reduce water pollution","save energy","save","tap is running","tell","throw rubbish around","turn off the lights","turn off the tap","turn on the lights","unplug TV","use environmentally friendly products","use filter","use less water","use private cars","use public transportation","use solar energy","use wind energy","warn","waste energy","waste water","want to","air pollution","electrical devices","environment","everywhere","exhaust gases","factory","garbage","litter","rubbish","junk food","light","living being","lung","natural sources","noise pollution","tap","traffic jam","water pollution","water sources","careful","clean","crowded","dirty","important","noisy","I'm not sure","I'm sure","instead","moreover","regularly","so","there is","there are","wait a second","with"
      ],
      unit10: [
        "agree","ask opinion","become","choose","create election campaign","decide","find","fold the paper","give a speech","know","make a poster","make a speech","make noise","need","prepare","put","respect other’s right","respect","elect class president","support","take","think","vote","win","write","fair","important","kind","excited","equal","respectful","responsible","over","ballot box","cabinet","campaign","candidate","child rights","class presidency","close friend","education","election","envelope","equality","fair law","health care","law","other’s right","poll","preparation","president","protection","public","public building","right","thing"
      ]
    };
    const unitWords7 = {
      unit1: [
        "cheerful","clever","creative","easygoing","fair","forgetful","funny","generous","hardworking","helpful","honest","kind","outgoing","patient","polite","popular","punctual","selfish","smart","stubborn","talkative","thoughtful","tolerant","attractive","beard","beautiful","blonde","curly","cute","dark","eye-glasses","fat","freckle","grey hair","good looking","handsome","hazel","headscarf","long","middle aged","moustache","muscle","of medium height","of medium weight","old","overweight","plump","red hair","short","slim","small","straight","strong","sweet","tall","thin","ugly","wavy","weak","well built","young","be late","buy gifts","celebrity","describe","don’t care","family member","friend","get along with","get high marks","get on well","go on time","hang out with friends","have got","help","look like","lucky","look beautiful","patiently","relative","look handsome","reach shelves","share","stay at home","support","tell lie","tell the truth","wear headscarf"
      ],
      unit2: [
        "athlete","achieve","ball","beat","compete","compete in the races","court","cycling","diving","do a sport","draw","eat healthy food","equipment","exercise","exercise in the gym","get up","gloves","go on a diet","go to the gym","goggles","gym","have breakfast","have energy drinks","have junk food","have protein","hit a ball","hurt leg","ice skating","individual sports","indoor sports","injury","jogging","join a sports activity","keep fit","knee pads","lose the match","make a goal","medal","net","opponent team","own","outdoor sports","player","pool","practice","prize","racket","ride bike","rollerskate","running","safety","score a point","score goal","score point","skateboard","skiing","snow jacket","snowboard","spectator","sportsman","stadium","stay in bed","success","swimmer","swimming","swimsuit","team sports","team","to be bad at","to be good at","trainers","training","wakeup early","watch a match","water sports","weights","win gold medal","winter sports","never","hardly ever","rarely","seldom","sometimes","often","usually","generally","always","once","once a week","twice","twice a year","three times"
      ],
      unit3: [
        "achievement","alone","attend","award","be born","become","begin","biography","birth","brilliant","bronze","career","championship","change","childhood","compete","compose","composer","conduct","create","date of birth","decide","design","develop","die","discover","discoverer","education","elect","electric bulb","establish","family life","famous","find","fulfill","gain","get a prize","get engaged","get married","get retired","gold medal","graduate","gravity","grow up","happen","have a child","have experience","invent","inventor","join the army","learn","leave school","letter","live","lose","meet","move","old ages","own","pass away","patriot","perform","personal life","place of birth","primary school","prize","profession","raise","reach","receive diploma","school life","science","silver","soldier","stay at home","stay","study","success","take place","teach","use","want","win","became","died","discovered","found","got","got married","gave","went","graduated","grew up","happened","had","learnt","left","met","moved","raised","received","researched","searched","separated from","stayed","studied","took","told","used","visited","wanted","was born","wrote"
      ],
      unit4: [
        "bear","bison","camel","cheetah","chimpanzee","crocodile","deer","dolphin","eagle","elephant","falcon","giraffe","gorilla","hawk","horse","kangaroo","koala bear","lion","lizard","monkey","octopus","ostrich","owl","penguin","pigeon","polar bear","rhino","seagull","seal","shark","snake","squirrel","tiger","turtle","whale","zebra","desert","forest","grassland","jungle","land","mountain","ocean","sea caves","sky","water","claw","ear","fin","foot","fur","nail","neck","paw","skin","stripe","teeth","trunk","wing","birds","carnivores","cold-blooded","herbivores","mammals","reptiles","vertebrates","warm-blooded","attack","awesome","become extinct","big","cause global warming","cute","dangerous","destroy","diet","educate people","endangered animals","enormous","excellent","extinct animals","fast","find prey","funny","give harm","global warming","habitat","harm","heavy","hunt animals","hunt","hunter","in danger","incredible","interesting","keep clean","kill","kind","large","lifespan","plant tree","poisonous","pollute environment","population","pretty","prevent","prey","protect forest","protect wild life","sharp","size","stop global warming","stop overhunting","strong","survive","take precuation","unusual","wear fur","weight","wild"
      ],
      unit5: [
        "action movie","adventure","cartoon","comedy","commercials","cookery programme","discussion","documentary","drama","horror movie","love story","morning show","news","quiz show","reality show","science fiction","series","sitcom","soap opera","talk show","weather forecast","wedding programme","all","amazing","amusing","boring","crazy","dull","during","educational","educative","enjoyable","entertaining","exciting","fantastic","frightening","fun","funny","harmful","historical","informative","interesting","nonsense","ridiculous","scary","silly","useless","about","be crazy about","be interested in","become an addict","can’t stand","can’t wait","director","dislike","enjoy","expand knowledge","follow lives of people","general audiences","hate","have dinner","know all the questions","know what’s going on","laugh","learn new things","like","love","miss new episodes","for hours","negative examples","pass time happily","prefer","recommend","remote control","skip meals","spend time","stay up late","suitable for","violence","watch"
      ],
      unit6: [
        "anniversary","birthday","celebrate","celebration","costume","decorate","decoration","engagement","entertainment","festival","gift","graduation","invitation","invite","national holiday","party","present","religious holiday","special day","surprise","traditional","Valentine’s Day","wedding","wedding ceremony","wedding party","wedding anniversary","accept","arrange","attend","be busy","bring","buy","call","cancel","come","decorate the house","do shopping","dress up","eat cake","enjoy","get ready","give a gift","go out","have a party","have fun","invite friends","make a cake","make a wish","organize","plan","prepare","refuse","send invitation","sing a song","take photos","wear costume","write a card","yes","no","maybe","sure","of course","I’d love to","I’m sorry","I can’t","I’m busy","I’m not sure","I’ll try"
      ],
      unit7: [
        "astronaut","artist","baker","basketball player","businessman","chef","dentist","designer","doctor","engineer","farmer","firefighter","footballer","hairdresser","mechanic","nurse","pilot","police officer","scientist","singer","teacher","vet","waiter","writer","dream","future","goal","hope","imagine","job","plan","profession","success","want","wish","would like","achieve","become","decide","earn money","get a job","graduate","have a career","help people","live abroad","make a decision","make money","study hard","take an exam","travel","work hard","work in a hospital","work in a company","work with animals","work with children","work outdoors","work indoors","work at weekends","work full time","work part time","What do you want to be","I want to be a doctor","I’d like to be a pilot","I hope to become a teacher","I plan to study engineering"
      ],
      unit8: [
        "airport","bank","bookstore","bus station","cafe","cinema","fire station","gym","hairdresser","hospital","hotel","library","market","mosque","museum","park","pharmacy","police station","post office","restaurant","school","shopping mall","stadium","supermarket","theatre","train station","zoo","go straight ahead","turn left","turn right","take the first left","take the second right","on the corner","next to","opposite","between","behind","in front of","near","far","How can I get to the museum","Where is the hospital","It’s on the right","It’s opposite the bank","Go straight ahead and turn left","Take the second right"
      ],
      unit9: [
        "air pollution","climate change","deforestation","drought","earthquake","environment","flood","global warming","greenhouse effect","natural disaster","pollution","recycling","rubbish","storm","temperature","tidal wave","trash","volcano","waste","wildfire","clean","damage","destroy","drop litter","harm","pollute","protect","recycle","reduce","reuse","save","throw away","use","cause","prevent","What causes air pollution","How can we protect the environment","We should recycle","We shouldn’t drop litter","Let’s clean the beach","Don’t throw rubbish on the ground"
      ],
      unit10: [
        "astronomy","astronaut","atmosphere","comet","cosmos","Earth","eclipse","galaxy","gravity","Jupiter","Mars","Mercury","moon","Neptune","planet","Pluto","rocket","Saturn","solar system","space","spaceship","star","sun","telescope","Uranus","Venus","alien","black hole","light year","meteor","orbit","satellite","shooting star","space station","surface","universe","What is the largest planet","Jupiter is the largest planet","Earth orbits the sun","The moon has no atmosphere","Astronauts travel in spaceships"
      ]
    };
    const unitWords8 = {
      unit1: [
        "accept","apologise","ask","attend","back up","become","break promise","buddy","call","care","choose","close friend","come over","concert","count on","decide","describe","dishonesty","each other","excuse","experience","fair","fashionable","feel alone","friendship","fun","funny","generation","get on well","give advice","guess","guest","have a lot in common","honest","hope","how about","how is it going","idea","important","individual","instead","interested in","introduce","invitation","invite","keep promise","keep secret","laid back","learn","letter","lie","like","loyal","loyalty","match","mate","mean","meet","movie theatre","mutual respect","need","neighbour","not at all","occupied","occur","of course","offer","others","outgoing","patience","patient","personality","prefer","prepare snack","priceless","promise","rarely","reason","refuse","relationship","relaxed","reliable","rely on","remain","respect","respectful","same meaning","same opinion","self-disciplined","share","solemn","sorry I can’t","sounds fun","sounds good","sounds great","spend time","still","strong bond","stuffed","support each other","supportive","sure","survive","take things serious","talk","tell lie","tell secret","tell","text","that would be great","that’s why","thing","thirsty","thrilling","true friend","trust","unconditional","understand","want","what about","why not","would you like to","your own"
      ],
      unit2: [
        "admire","adult","advise","always","amazing","argue","art club","band","buy","can’t stand","casual clothes","chat","cheap","choose","come over","comfortable","concert","conversation","different","do exercise","documentaries","drummer","each other","easily","easy","educational","educative","enjoy","enjoyable","enlarge horizon","event","everywhere","express","fashion","fast","follow","fond of","for example","form a band","free time","good relationship","gym","hang around","hang out","hate","healthy","hiking","historical","impressive","individual sport","keen on","kind","latest","loud","more or less","most of the time","mostly","national","no way","patriot","personal opinion","prefer","rarely","reach","recommend","relaxing","rest","same","science fiction","seldom","send","smart clothes","snob","sometimes","spend time","suggest","talk about","team sport","teenagers","terrific","text","that’s why","things","think","ticket","to be honest","train in the field","trendy","type","unbearable","usually","wear","weather","weekend","what about","what kind of","what type of","while","work out","youth stories"
      ],
      unit3: [
        "a pinch of salt","add","after that","another","bake","baking powder","baking soda","baking tray","batter","bean","beef","boil","boiled","both sides","bowl","bread crumb","brush","butter","cake tin","cardamom powder","celery","chicken stock","chop","chopped","cinnamon","combine","cook","corn starch","cover","cumin","cut","cut in halves","describe process","dessert","difficult","dice","dish","dissolve","divide","drain","dough","easy","fill","finally","first","flour","from","fry","fridge","frying pan","garlic","get brown","get thick","grated","grater","grill","high heat","homemade bread","hour","how long","how many","how much","how to make","ingredients","into","kitchen tools","knead","knife","later","large","lemon juice","lemon peel","make dough","make it rest","mashed","meal","medium heat","melt the yeast","melted","method","minute","minced beef","minced garlic","mixture","mussels","need","next","nut","oiled","oven","paella","pan","paprika","parsley","pasta","pepper","place","plate","pot","pour","prawn","prefer","preheat","preheated","prepare","preparation","put","raisin","recipe","red pepper flakes","refrigerator","remember","remove","rinse","rise","roast chicken","rolling pin","salt","saffron","saucepan","season","second","seal the dumpling","serve","serve warm","set aside","shape","sharp","sheets of phyllo","slice","slightly","smooth","soak","spices","spicy","spoon","spread","sprinkle","square","starch","stir","strain","stretch","syrup","tasty","temperature","tender","then","till","top","tortilla","tray","turn brown","until","use","vegetables","whisk","while","with"
      ],
      unit4: [
        "answer","application","appointment","arrange","ask","at the moment","available","begin","call","caller","can I","cell phone","change","communication","company employee","concert hall","connection","contact","conversation","could you","delivery","device","dial a number","dial","different","discover","each other","engaged","experimental","extension number","fast","feel better","fine","get back","get well soon","get","give","graduation","great","guess","habit","hang on","headquarter","hear","here","hold on","how often","I guess","I’ll get him","I’ll take that","I’m afraid","I’m sorry to hear that","ill","imagine","interviewer","invented","invention","journal","just a minute","keep in touch","learn","leave","line","live chat","make arrangement","make phone call","may I speak to","may I","meet","memo","need","of course","once upon a time","overseas phone call","polite","possible","prefer","put through","reach information","receiver","reminder","repeat","replace","revolution","ring","send messages","shout","smart phone","soon","study together","sure","take care","talk","tell","text a message","the most","try","understand","want","waste time","way","what’s wrong with you","who","with","without","would you like to","write letter","you are welcome"
      ],
      unit5: [
        "account","addict","adult","advantage","advise","affect","among","application","attachment","authorities","become internet addict","break relationship","broken","browse","browser","busy","buy","by mistake","careful","cause","cell phone","change","chat live","cheapest","check cable","comment","comment a post","communicate","confirm","connect","connection","contact","conversation","create content","dangerous","delete","detail","develop social skills","disadvantage","do research","download","easiest","feel isolated","get information","give harm","go online","harmful","hour","ignore","important","instant messaging","keep in touch with","leave a comment","letter","log in","log off","make life difficult","make new friends","make research","mean","meet strangers","member","others","password","percent","phone call","prefer","register","remember","reply","reset","safety","screen","search engine","secret word","send","share personal information","sign up","sorry to hear that","sounds good","spend too much time","store","surf on internet","take precaution","teen","teenager","tell","text","text message","upload","upload pictures","useful","useful purpose","username","via","want","way","ways of communication"
      ],
      unit6: [
        "anniversary","birthday","celebrate","celebration","costume","decorate","decoration","engagement","entertainment","festival","gift","graduation","invitation","invite","national holiday","party","present","religious holiday","special day","surprise","traditional","Valentine’s Day","wedding","wedding ceremony","wedding party","wedding anniversary","accept","arrange","attend","be busy","bring","buy","call","cancel","come","decorate the house","do shopping","dress up","eat cake","enjoy","get ready","give a gift","go out","have a party","have fun","invite friends","make a cake","make a wish","organize","plan","prepare","refuse","send invitation","sing a song","take photos","wear costume","write a card","yes","no","maybe","sure","of course","I’d love to","I’m sorry","I can’t","I’m busy","I’m not sure","I’ll try"
      ],
      unit7: [
        "astronaut","artist","baker","basketball player","businessman","chef","dentist","designer","doctor","engineer","farmer","firefighter","footballer","hairdresser","mechanic","nurse","pilot","police officer","scientist","singer","teacher","vet","waiter","writer","dream","future","goal","hope","imagine","job","plan","profession","success","want","wish","would like","achieve","become","decide","earn money","get a job","graduate","have a career","help people","live abroad","make a decision","make money","study hard","take an exam","travel","work hard","work in a hospital","work in a company","work with animals","work with children","work outdoors","work indoors","work at weekends","work full time","work part time","What do you want to be","I want to be a doctor","I’d like to be a pilot","I hope to become a teacher","I plan to study engineering"
      ],
      unit8: [
        "airport","bank","bookstore","bus station","cafe","cinema","fire station","gym","hairdresser","hospital","hotel","library","market","mosque","museum","park","pharmacy","police station","post office","restaurant","school","shopping mall","stadium","supermarket","theatre","train station","zoo","go straight ahead","turn left","turn right","take the first left","take the second right","on the corner","next to","opposite","between","behind","in front of","near","far","How can I get to the museum","Where is the hospital","It’s on the right","It’s opposite the bank","Go straight ahead and turn left","Take the second right"
      ],
      unit9: [
        "air pollution","climate change","deforestation","drought","earthquake","environment","flood","global warming","greenhouse effect","natural disaster","pollution","recycling","rubbish","storm","temperature","tidal wave","trash","volcano","waste","wildfire","clean","damage","destroy","drop litter","harm","pollute","protect","recycle","reduce","reuse","save","throw away","use","cause","prevent","What causes air pollution","How can we protect the environment","We should recycle","We shouldn’t drop litter","Let’s clean the beach","Don’t throw rubbish on the ground"
      ],
      unit10: [
        "astronomy","astronaut","atmosphere","comet","cosmos","Earth","eclipse","galaxy","gravity","Jupiter","Mars","Mercury","moon","Neptune","planet","Pluto","rocket","Saturn","solar system","space","spaceship","star","sun","telescope","Uranus","Venus","alien","black hole","light year","meteor","orbit","satellite","shooting star","space station","surface","universe","What is the largest planet","Jupiter is the largest planet","Earth orbits the sun","The moon has no atmosphere","Astronauts travel in spaceships"
      ]
    };

  let currentGrade = '5';
  let currentUnit = 'unit1';
  let WORDS = [];
  let calledWords = [];
  const gradeSelect = document.getElementById('grade-select');
  const unitSelect = document.getElementById('unit-select');

    function getUnitWords(grade, unit) {
      if(grade==='5') return unitWords5[unit] || [];
      if(grade==='6') return unitWords6[unit] || [];
      if(grade==='7') return unitWords7[unit] || [];
      if(grade==='8') return unitWords8[unit] || [];
      return [];
    }

    function updateWords(){
      WORDS = getUnitWords(currentGrade, currentUnit);
      buildBoard();
      markBoard();
      resetCaller();
    }

    if(gradeSelect){
      gradeSelect.addEventListener('change', function(){
        currentGrade = this.value;
        currentUnit = 'unit1';
        updateWords();
        stopAutoCall();
      });
    }
    if(unitSelect){
      unitSelect.addEventListener('change', function(){
        currentUnit = this.value;
        updateWords();
        stopAutoCall();
      });
    }

    const board = document.getElementById('board-90');
    const gridDrawn = document.getElementById('drawn-grid');
    const lastEl = document.getElementById('last-number');

    updateWords();
    const COLS=9, ROWS=3, CARDS_PER_STRIP=6;
    const shuffle = a => { for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1)|0); [a[i],a[j]]=[a[j],a[i]]; } return a; };

    function generateWordStrip(){
      const allWords = shuffle([...WORDS]);
      if (allWords.length < 40) throw new Error('Yeterli kelime yok! (En az 40 kelime olmalı)');
      let idx = 0;
      const tickets = [];
      for(let t=0; t<6; t++){
        const grid = Array.from({length:ROWS},()=>Array(COLS).fill(null));
        for(let r=0; r<ROWS; r++){
          const cols = shuffle([...Array(COLS).keys()]).slice(0,5);
          for(const c of cols){
            grid[r][c] = allWords[idx++];
          }
        }
        tickets.push(grid);
      }
      return tickets;
    }
    function generateWordStripWithRetry(max=400){ for(let i=0;i<max;i++){ try{ const g=generateWordStrip(); if(g) return g; }catch(e){} } throw new Error('Geçerli kelime strip üretilemedi.'); }

    function buildBoard(){
      board.innerHTML='';
      let idx = 0;
      for(let i=0; i<WORDS.length; i++){
        const d = document.createElement('div');
        d.className='cell';
        d.dataset.n = idx;
        d.textContent = WORDS[idx] || '';
        board.appendChild(d);
        idx++;
      }
    }
    function markBoard(){
      document.querySelectorAll('#board-90 .cell').forEach(el=>{
        el.classList.toggle('mark', calledWords.includes(el.textContent));
      });
    }
    function renderLists(){
      gridDrawn.innerHTML='';
      for(const w of [...calledWords].reverse()){
        const s=document.createElement('span'); s.className='pill'; s.textContent=w;
        gridDrawn.appendChild(s);
      }
      markBoard();
    }

    function pickLang(){
  return 'en-US';
    }
    function pickVoiceFor(lang){
      const voices = speechSynthesis.getVoices();
      const langBase = lang.split('-')[0].toLowerCase();
      let cand = voices.filter(v =>
        v.lang && (v.lang.toLowerCase() === lang.toLowerCase() ||
                   v.lang.toLowerCase().startsWith(langBase))
      );
      const femaleHints = ['seda','filiz','elif','banu','ayça','zeynep','yağmur','dilara','female','woman','wavenet-a','neural female'];
      let v = cand.find(v => femaleHints.some(h => v.name.toLowerCase().includes(h)));
      if (!v) v = cand[0];
      if (!v) v = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(langBase));
      return v || null;
    }
    function speakNumber(n){
  if(!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance();
  u.lang = 'en-US';
  u.text = `${n}`;
  const v = pickVoiceFor('en-US');
  if(v) u.voice = v;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
    }
    function voicesReady(cb){ if(speechSynthesis.getVoices().length) cb(); else speechSynthesis.onvoiceschanged = cb; }
    voicesReady(function(){
      document.getElementById('btn-call').disabled = false;
    });

  function resetCaller(){ calledWords=[]; lastEl.textContent='–'; renderLists(); }

    function callWord(){
      if(calledWords.length===WORDS.length) return;
      let w;
      do{
        w = WORDS[Math.floor(Math.random()*WORDS.length)];
      }while(calledWords.includes(w));
      calledWords.push(w);
      lastEl.textContent=w;
      renderLists();
      speakNumber(w);
    }

    let bandTexts=['WORD BİNGOBALA'], bandIndex=0;
  const nextBand = ()=> 'WORD BİNGOBALA';

    function getOpts(){
      return {
        bandColor: document.getElementById('opt-band-color').value || '#f32509ff',
        bandTextColor: document.getElementById('opt-band-text-color').value || '#f1e6e6ff',
        serialStart: parseInt(document.getElementById('opt-serial-start').value||'1',10),
        pages: Math.max(1, parseInt(document.getElementById('opt-pages').value||'1',10)),
        baseName: (document.getElementById('opt-basename').value||'WordBingoBala_').trim()
      };
    }

    function drawTicket(
      doc, x, y, w, h, grid, serial,
      bandColor, bandText, bandTextColor
    ){
      const [br,bg,bb]=hexToRgb(bandColor,[255,165,0]);
      const [tr,tg,tb]=hexToRgb(bandTextColor,[0,0,0]);
      const BAND_H = cm(0.8);

      const gridY = y + BAND_H, gridH = h - BAND_H;
      const cellW = w/9, cellH = gridH/3;

      doc.setDrawColor(40); doc.setLineWidth(0.2); doc.setTextColor(0);
      for(let r=0;r<3;r++){
        for(let c=0;c<9;c++){
          const cx=x+c*cellW, cy=gridY+r*cellH;
          doc.rect(cx,cy,cellW,cellH);
          const v=grid[r][c]; if(v==null) continue;
          doc.setFont(FONT_TEXT,'normal');
          const fit = fitTextToWidth(doc, v, cellW*0.92, 36, 8, 12);
          doc.setFontSize(fit.size);
          if (fit.lines.length === 1) {
            doc.text(fit.lines[0], cx+cellW/2, cy+cellH/2, {align:'center', baseline:'middle'});
          } else if (fit.lines.length === 2) {
            const lineH = fit.size + 2;
            const y1 = cy+cellH/2 - lineH/2;
            const y2 = cy+cellH/2 + lineH/2;
            doc.text(fit.lines[0], cx+cellW/2, y1, {align:'center', baseline:'middle'});
            doc.text(fit.lines[1], cx+cellW/2, y2, {align:'center', baseline:'middle'});
          }
        }
      }

      const bandTop = y;
      doc.setFillColor(br,bg,bb);
      doc.rect(x, bandTop, w, BAND_H, 'F');

 
  let text = bandText; if(FONT_TEXT!=='Uni') text = transliterate(text);
  doc.setTextColor(tr,tg,tb); doc.setFont(FONT_TEXT,'bold');
  const fit = fitTextToWidth(doc, text, w*0.92, 36, 8, 12);
  doc.setFontSize(fit.size);
  const bandTextY = bandTop + BAND_H*0.42;
  doc.text(fit.lines[0], x+w/2, bandTextY, {align:'center', baseline:'middle'});

  
  const serialStr = String(serial).padStart(5,'0');
  doc.setFont(FONT_NUM,'bold'); doc.setFontSize(6); doc.setTextColor(255,255,255);
  const serialY = bandTop + BAND_H - 2; // alt kenara yakın
  doc.text(serialStr, x+w/2, serialY, {align:'center', baseline:'bottom'});

  const dashedY = Math.max(bandTop-1, 0);
  doc.setLineDash([4,2],0); doc.setDrawColor(0);
  doc.setLineWidth(1.4);
  doc.line(x, dashedY, x+w, dashedY);
  doc.setLineDash();
  doc.setLineWidth(0.2);
    }

    async function generatePdf(){
      if(!window.jspdf || !window.jspdf.jsPDF){
        alert('PDF oluşturucu (jsPDF) yüklenemedi! İnternet bağlantınızı ve sayfa kaynağını kontrol edin.');
        return;
      }
      const { jsPDF } = window.jspdf;
      const o = getOpts();
      const doc = new jsPDF({unit:'pt', format:'a4', compress:true});
      await tryLoadUnicodeFont(doc);

  const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight();
  const MARGIN_T = cm(0.8), MARGIN_B = cm(0.3), MARGIN_LR = cm(0.8), MARGIN_RR = cm(0.8);
  const STRIP_W = pageW - MARGIN_LR - MARGIN_RR;
  const availH = pageH - MARGIN_T - MARGIN_B;
  const ticketH = availH / CARDS_PER_STRIP;
      function drawHeaderFooter() {
        doc.setFontSize(10);
        doc.setTextColor(80,80,80);
        doc.text('https://sonsuzyasam.github.io/WordBingo/', pageW/2, cm(0.5), {align:'center'});
        doc.text('https://sonsuzyasam.github.io/WordBingo/', pageW/2, pageH-cm(0.2), {align:'center'});
      }

      let serial = o.serialStart;
      const ts=new Date(), pad=n=>String(n).padStart(2,'0');
      const stamp = ts.getFullYear()+pad(ts.getMonth()+1)+pad(ts.getDate())+'_'+pad(ts.getHours())+pad(ts.getMinutes())+pad(ts.getSeconds());
      const pdfName = `${o.baseName||'WordBingoBala_'}${stamp}.pdf`;

      function drawStrip(tickets) {
        for (let i=0; i<CARDS_PER_STRIP; i++) {
          const y = MARGIN_T + i * ticketH;
          drawTicket(doc, MARGIN_LR, y, STRIP_W, ticketH, tickets[i], serial,
            o.bandColor, nextBand(), o.bandTextColor
          );
          serial++;
        }
      }

      for(let p=0; p<o.pages; p++){
  drawHeaderFooter();
  const left  = generateWordStripWithRetry();
  drawStrip(left);
  if(p<o.pages-1) doc.addPage();
      }

      doc.save(pdfName);
    }

    document.getElementById('btn-call').addEventListener('click',callWord);
  document.getElementById('btn-reset').addEventListener('click',()=>{ calledWords=[]; lastEl.textContent='–'; renderLists(); });
  document.getElementById('btn-reset').addEventListener('click',()=>{ calledWords=[]; lastEl.textContent='–'; renderLists(); stopAutoCall(); });
  document.getElementById('btn-pdf').addEventListener('click',generatePdf);

  let autoCallTimer = null;
  let lastAutoCallInterval = 0;
    function startAutoCall(intervalSec) {
      stopAutoCall(false);
      if (intervalSec > 0) {
        lastAutoCallInterval = intervalSec;
        autoCallTimer = setInterval(() => {
          if (calledWords.length < WORDS.length) {
            callWord();
          } else {
            stopAutoCall();
          }
        }, intervalSec * 1000);
        document.getElementById('btn-auto-call-stop').textContent = 'Durdur';
      }
    }
    function stopAutoCall() {
      if (autoCallTimer) {
        clearInterval(autoCallTimer);
        autoCallTimer = null;
        document.getElementById('btn-auto-call-stop').textContent = 'Devam';
      }
    }
    document.getElementById('auto-call-select').addEventListener('change', function(e) {
      const sec = parseInt(e.target.value, 10);
      if (sec > 0) {
        startAutoCall(sec);
      } else {
        stopAutoCall();
      }
    });
    document.getElementById('btn-auto-call-stop').addEventListener('click', function(){
      if (!autoCallTimer && lastAutoCallInterval > 0) {
        startAutoCall(lastAutoCallInterval);
      } else {
        stopAutoCall();
      }
    });

    refreshSourceUi(); setBandsInfo(); buildBoard(); loadPreset('valentine'); resetCaller();
  }
})();