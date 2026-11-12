// Six benchmark examples with recorded search ranks and passage links.
window.SECOND_HOP_EXAMPLES = [
  {
    "id": "blood-street",
    "label": "Blood Street",
    "dataset": "2WikiMultihopQA",
    "question": "What nationality is the director of film Blood Street?",
    "nodes": [
      {
        "id": 87,
        "title": "Blood Street",
        "text": "Blood Street is a 1988 film co-directed by Leo Fong. It stars Fong in a reprised role as private detective Joe Wong who has been hired to find a woman's husband who has gone missing. Richard Norton, Stan Wertlieb, Stack Pierce, Chuck Jeffreys and Kymberly Paige also appear in the film.",
        "rank": 1,
        "supporting": true
      },
      {
        "id": 92,
        "title": "Leo Fong",
        "text": "Leo Fong (born November 23, 1928) is a Chinese American actor, martial artist, boxer, and former Methodist minister who has been making films, acting, and directing since the early 1970s. His latest film role is in \"Challenge of Five Gauntlets\" which was released in 2018.",
        "rank": 504,
        "supporting": true
      },
      {
        "id": 88,
        "title": "Jackie Kong",
        "text": "Jackie Kong is an American screenwriter, film producer, and film director known for the cult horror film\" Blood Diner\".",
        "rank": 2,
        "supporting": false
      },
      {
        "id": 3450,
        "title": "The Blood Demon",
        "text": "The Blood Demon( Die Schlangengrube und das Pendel in West Germany), also known as The Torture Chamber of Dr. Sadism, The Snake Pit and the Pendulum, and Castle of the Walking Dead, is a 1967 West German horror film directed by Harald Reinl and starring Christopher Lee, Karin Dor, and Lex Barker. The film, written by Manfred R. Köhler, is based on Edgar Allan Poe's 1842 short story\" The Pit and the Pendulum\" and concerns the saga of Count Regula( Lee) who, after being drawn and quartered for murdering 12 maidens, returns to life seeking revenge. The film was advertised in Rhode Island newspapers as Crimson Demon, due to a practice at the time of deleting the word\" Blood\" from film titles. It was shot at the Bavaria Studios in Munich. The film's sets were designed by the art directors Gabriel Pellon and Rolf Zehetbauer.",
        "rank": 3,
        "supporting": false
      },
      {
        "id": 5040,
        "title": "The Mad Doctor of Blood Island",
        "text": "The Mad Doctor of Blood Island is a 1969 Filipino horror film, co- directed by Eddie Romero and Gerardo de Leon, and starring John Ashley, Eddie Garcia and Ronald Remy. It was the third in a series of four Filipino horror films produced by Romero and Kane W. Lynn known as the\" Blood Island\" series, which also included\" Terror Is a ManBrides of Blood\" and\" Beast of Blood\". Beverly Miller was associate producer on this film, and later went on to co-produce several other Filipino horror films. This film dared to go a step further than\" Brides of Blood\" in the nudity and gore department. The plot involves a man traveling to an island where a mad scientist named Dr. Lorca is creating human/ plant mutants with chlorophyll blood out of the local natives. The film was later syndicated to television as Tomb of the Living Dead. It was also briefly known in certain states as The Mad Doctor of Crimson Island.",
        "rank": 4,
        "supporting": false
      },
      {
        "id": 5036,
        "title": "Brides of Blood",
        "text": "Brides of Blood( a.k.a. Brides of the Beast and Grave Desires) is a 1968 Filipino horror film, co- directed by Eddie Romero and Gerardo de Leon, and starring John Ashley, Kent Taylor, Beverly Hills, Eva Darren and Mario Montenegro. It was the first movie that Ashley made in the Philippines, beginning a long association between Ashley and that country. \" Brides of Blood\" was the second in a series of four horror films produced by Romero and Kane W. Lynn known as the\" Blood Island\" series, which also included\" Terror Is a Man The Mad Doctor of Blood Island\" and\" Beast of BloodBrides of Blood\" was later released to television syndication in some areas as Island of Living Horror.",
        "rank": 5,
        "supporting": false
      },
      {
        "id": 5038,
        "title": "Terror Is a Man",
        "text": "Terror Is a Man( also known as Blood Creature, Creature from Blood Island, The Gory Creatures, Island of Terror and Gore Creature) is a 1959 black- and- white Filipino/ American horror film directed by Gerardo de Leon. It was the first in a series produced by Eddie Romero and Kane W. Lynn known as the\" Blood Island\" series, which also included\" Brides of Blood The Mad Doctor of Blood Island\" and\" Beast of Blood\". All four films took place on an island called Blood Island, named for its vivid red-hued sunsets. The film focuses on a shipwreck survivor washed ashore on a small island where a scientist is experimenting on a panther in an effort to make it human.",
        "rank": 6,
        "supporting": false
      },
      {
        "id": 5042,
        "title": "Beast of Blood (film)",
        "text": "Beast of Blood, released in the UK as Blood Devils, is a 1970 Filipino horror film. A sequel to\" The Mad Doctor of Blood Island\", it was directed by Eddie Romero. It was the fourth in a series of four Filipino horror films, produced by Romero and Kane W. Lynn, known as the\" Blood Island\" series, which also included\" Terror Is a ManBrides of Blood\" and\" Beast of Blood\". It was also Romero's last film for Lynn's Hemisphere Pictures, as the two went their separate ways after this film was completed.",
        "rank": 7,
        "supporting": false
      },
      {
        "id": 2669,
        "title": "David Ayer",
        "text": "David Ayer( born January 18, 1968) is an American film director, producer and screenwriter. He wrote\" Training Day\"( 2001), co-wrote\" The Fast and the Furious\"( 2001), and directed\" Harsh Times\"( 2005),\" Street Kings\"( 2008),\" End of Watch\"( 2012),\" Sabotage\"( 2014),\" Fury\"( 2014),\" Suicide Squad\"( 2016) and\" Bright\"( 2017).",
        "rank": 8,
        "supporting": false
      }
    ],
    "edges": {
      "S": [
        [
          87,
          92
        ],
        [
          5040,
          5038
        ],
        [
          5036,
          5038
        ],
        [
          5038,
          5042
        ]
      ],
      "R": [
        [
          87,
          92
        ],
        [
          5040,
          5036
        ],
        [
          5040,
          5038
        ],
        [
          5040,
          5042
        ],
        [
          5036,
          5038
        ]
      ],
      "N": [
        [
          87,
          92
        ],
        [
          5040,
          5036
        ],
        [
          5040,
          5038
        ],
        [
          5040,
          5042
        ],
        [
          5036,
          5038
        ],
        [
          5036,
          5042
        ],
        [
          5038,
          5042
        ]
      ],
      "K": [
        [
          87,
          92
        ],
        [
          87,
          5036
        ],
        [
          5040,
          5036
        ],
        [
          5040,
          5038
        ],
        [
          5040,
          5042
        ],
        [
          5036,
          5038
        ],
        [
          5036,
          5042
        ],
        [
          5038,
          5042
        ]
      ]
    }
  },
  {
    "id": "saw-thanda",
    "label": "Saw Thanda",
    "dataset": "2WikiMultihopQA",
    "question": "Where did Saw Thanda's husband die?",
    "nodes": [
      {
        "id": 582,
        "title": "Min Dikkha",
        "text": "Min Dikkha (1515–1556) was ruler of the Kingdom of Mrauk U from 1554 to 1556. He was the heir-apparent of the kingdom for 22 years during the reign of his father, King Min Bin. Dikkha was an able military commander who led the Arakanese navy in Min Bin's conquest of Bengal in 1532–1533. He led the Royal Arakanese Navy in the Taungoo–Ava War (1538–45), and in the Taungoo–Mrauk-U War (1545–47). He built the Koe-thaung Temple, the largest of all temples in Mrauk U during his short reign.",
        "rank": 145,
        "supporting": true
      },
      {
        "id": 583,
        "title": "Saw Thanda",
        "text": "Saw Thanda Dewi  was queen consort to four consecutive of kings of Arakan. She was the chief queen of King Dikkha (r. 1554–56). She later became queen to King Saw Hla (r. 1556–64) and King Sekkya (1564–72), both of whom were her step-sons, and later to King Phalaung (r. 1572–93).",
        "rank": 1,
        "supporting": true
      },
      {
        "id": 2729,
        "title": "Salin Mibaya",
        "text": "Salin Mibaya (also known as Narapati Medaw, နရပတိ မယ်တော်) was the chief queen of Viceroy Thado Dhamma Yaza II of Prome (r. 1551–1588). The second daughter of King Bayin Htwe of Prome and his chief queen Shwe Zin Gon was married three times. Her marriage to her first cousin Min Ba Saw—a son of her maternal uncle—was cut short when her brother King Narapati had him executed. Narapati then married her off to Sithu Kyawhtin, then governor of Salin, a powerful figure in the Confederation of Shan States, in a marriage of state in the late 1530s. (Prome was then a de facto vassal state of the Confederation, which controlled all of Ava territories except Toungoo in Upper Burma.) Her stay at Salin lasted until January 1544 when the city was captured by Toungoo forces under Gen. Bayinnaung. Her husband escaped to Ava (Inwa) but she was captured and sent to Pegu (Bago). In 1545, she was married to Nanda Yawda, a younger brother of Bayinnaung, at the coronation ceremony of Tabinshwehti at the Pegu Palace. She returned to her native Prome as queen in 1551 when her husband was appointed viceroy of the region by King Bayinnaung. She had two daughters by Nanda Yawda, now styled as Thado Dhamma Yaza II. Their elder daughter Hsinbyushin Medaw became the chief queen of Nawrahta Minsaw, the viceroy (and later king) of Lan Na. The younger daughter Min Taya Medaw was a major queen of Nanda.",
        "rank": 2,
        "supporting": false
      },
      {
        "id": 4605,
        "title": "Narayan Rao",
        "text": "Narayan Rao (10 August 1755 – 30 August 1773) was the 9th Peshwa of the Maratha Empire from November 1772 until his assassination in August 1773. He married Gangabai Sathe who later gave birth to Sawai Madhavrao Peshwa.",
        "rank": 3,
        "supporting": false
      },
      {
        "id": 1106,
        "title": "Osthryth",
        "text": "Osthryth (died 697), queen of the Mercians, was the wife of King Æthelred and daughter of King Oswiu of Northumbria and his second wife Eanflæd. She probably married Æthelred before 679 and was murdered by the nobles of Mercia. Osthryth was not the first of her family to become a Mercian queen. Her sister Alhflæd had married Peada, King of South Mercia 654-656. After the death of Peada, who was allegedly murdered with Alhflæd's connivance, and possibly Osthryth's as well, she retreated to Fladbury in Worcestershire, to judge both from the place-name, which means \"stronghold of Flæde\", and from its subsequent history: sometime in the 690s Æthelred granted Fladbury to Oftfor, Bishop of Worcester, to re-establish monastic life there; however, this grant was later contested by Æthelheard, son of Oshere, who maintained that Æthelred had no right to give Fladbury away, as it had been the property of Osthryth. Æthelheard claimed it as her kinsman and heir. Æthelred and Osthryth loved and favoured Bardney Abbey in Lincolnshire. Osthryth placed there the bones of her uncle Oswald of Northumbria, who was venerated as a saint. It is clear from this story that Osthryth played a part in promoting the cult of St Oswald. Many years later she persuaded Oswald's widow Cyneburh to take the veil. Osthryth had to contend with major conflicts of loyalty. In 679 her brother Ecgfrith of Northumbria fought a battle against Æthelred, in which Ecgfrith's brother Ælfwine was killed. Bede tells us that he was \"a young man of about eighteen years of age and much beloved in both kingdoms, for King Æthelred had married his sister.\" The murder of Osthryth in 697 by Mercian nobles is unexplained in the sources that mention it. Ann Williams attributes it to the hostility between the Mercians and the Northumbrians, while D. P. Kirby suggests that it may have been revenge for her sister's alleged involvement in Peada's murder. H. P. R. Finberg speculates that she and her kinsman Oshere were suspected of trying to detach the kingdom of the Hwicce from Mercian overlordship. Osthryth was buried at Bardney Abbey. Osthryth was probably the mother of Æthelred's son, Ceolred, king of Mercia from 709 to 716.",
        "rank": 4,
        "supporting": false
      },
      {
        "id": 234,
        "title": "Sisowath Kossamak",
        "text": "Sisowath Kossamak (9 April 1904 – 27 April 1975) was the Queen consort of Cambodia by marriage to King Norodom Suramarit from 1955 to his death in 1960. She then became co-head of state with her only son, Norodom Sihanouk, from 1960 to 1970. Sisowath Kossamak was born Princess of Cambodia as the daughter of King Sisowath Monivong and his wife Norodom Kanviman Norleak Tevi. Her official title was Preah Mohasatreiyani Sisowath Monivong Kossamak Nearirath Serey Vathana . Upon the death of Monivong in 1941, Sihanouk took the throne. In 1955, he abdicated in favor of his father Suramarit, who then reigned for five years. After her husband's death, Kossamak became the symbol and representative of the monarchy while Sihanouk assumed a role equal to that of a monarch. Both were overthrown in a 1970 coup, and they went into exile in China. Kossamak died there in 1975.",
        "rank": 5,
        "supporting": false
      },
      {
        "id": 704,
        "title": "Dudley Beaumont",
        "text": "Dudley John Beaumont( 1877–24 November 1918) was a British army officer and painter. He was the first husband of Sibyl Hathaway, 21st Seigneur of Sark, and grandfather of her successor, Michael Beaumont.",
        "rank": 6,
        "supporting": false
      },
      {
        "id": 3483,
        "title": "Từ Dụ",
        "text": "Từ Dụ or Từ Dũ (20 June 1810 – 12 May 1902), born Phạm Thị Hằng (范氏姮), was the wife of Thiệu Trị and mother of Tự Đức. Hằng was a daughter of Phạm Đăng Hưng. She was granted the title Empress Dowager Từ Dụ  after Tự Đức ascended the throne. Tự Đức died in 1883. Three regents, Nguyễn Văn Tường, Tôn Thất Thuyết and Trần Tiễn Thành, declared Dục Đức, the eldest adoptive-son of Tự Đức, as the new emperor. Three days later, they deposed Dục Đức and enthroned Hiệp Hòa. Từ Dụ was elevated to the position of one of the \"Tam Cung\" (三宮) together with Trang Ý and Học phi. Từ Dụ played a significant role in the dethronement of Hiệp Hòa, whom was a pro-French emperor, and enthroned Kiến Phúc. In 1885, she was granted the title Grand Empress Dowager Từ Dụ . Tôn Thất Thuyết decided to launch the Cần Vương movement against French colonists. \" Tam Cung\" fled to Tomb of Tự Đức together with Emperor Hàm Nghi. Thuyết decided to take them to a mountain base at Tân Sở, and then went to China to hide and seek reinforcements. \" Tam Cung\" refused, and came back to Huế. She was granted the title Great Grand Empress Dowager Từ Dụ  by Thành Thái in 1889. She died in 1902, and was given the posthumous name \"Empress Nghi Thiên\". A hospital in Ho Chi Minh City was named after her.",
        "rank": 7,
        "supporting": false
      },
      {
        "id": 3476,
        "title": "Thành Thái",
        "text": "Thành Thái( 14 March 1869 – 20 March 1954) born Nguyễn Phúc Bửu Lân( 阮福寶嶙), was the son of Emperor Dục Đức and Empress Dowager Từ Minh. He reigned for 18 years, from 1889 to 1907.",
        "rank": 8,
        "supporting": false
      }
    ],
    "edges": {
      "S": [
        [
          582,
          583
        ],
        [
          3483,
          3476
        ]
      ],
      "R": [
        [
          3483,
          3476
        ]
      ],
      "N": [
        [
          3483,
          3476
        ]
      ],
      "K": [
        [
          582,
          583
        ],
        [
          583,
          2729
        ],
        [
          3483,
          3476
        ]
      ]
    }
  },
  {
    "id": "icc-knockout",
    "label": "ICC KnockOut",
    "dataset": "HotpotQA",
    "question": "The 2000 ICC KnockOut Trophy was the debut of a Jamaican cricketer who is a right-handed what?",
    "nodes": [
      {
        "id": 85,
        "title": "Marlon Samuels",
        "text": "Marlon Nathaniel Samuels (born 5 February 1981) is a Jamaican cricketer who plays internationally for the West Indies in all three formats, and a former ODI captain. He is a right-handed middle order batsman and an off-spinner. He was a key member of the West Indies team that won the 2012 ICC World Twenty20 and 2016 ICC World Twenty20, and was named man of the match in the final of both tournaments, becoming first man to achieve the feat.",
        "rank": 6,
        "supporting": true
      },
      {
        "id": 91,
        "title": "2000 ICC KnockOut Trophy",
        "text": "The 2000 ICC KnockOut Trophy was a One Day International cricket tournament held in Kenya (which helped to booster cricket in Kenya). New Zealand were crowned champions and cashed the winner's cheque of US$250 000. It was their first win in a major ICC tournament. Zaheer Khan, Yuvraj Singh and Marlon Samuels made their ODI debuts during the competition.",
        "rank": 1,
        "supporting": true
      },
      {
        "id": 87,
        "title": "2000 ICC KnockOut Trophy squads",
        "text": "These were the eleven squads (all Test nations and two ODI nations) picked to take part in the 2000 ICC KnockOut Trophy, the second installment of the Champions Trophy cricket tournament. The tournament was held in Kenya from 3 to 15 October 2000. In the preliminary quarter finals, two ODI full-status teams Kenya and Zimbabwe played with India and Sri Lanka respectively, and India and Sri Lanka won their matches convincingly. In third preliminary quarter final, England beat Bangladesh to secure his position in Knockout Tournament. New Zealand won the second edition of the ICC KnockOut Trophy by defeating India in the final by four wickets, which was their first ICC event to be won.",
        "rank": 2,
        "supporting": false
      },
      {
        "id": 88,
        "title": "Ray Wynter",
        "text": "Ray Ricardo Wynter (born 27 November 1955) is a former Jamaican cricketer who played first-class and one-day cricket for Jamaica from 1975 until 1982. A right-handed batsman and right-arm opening bowler, he played 30 matches in all in those formats. In 1983, Wynter participated in a rebel tour of South Africa. As a result, he and all the other players on the tour received a lifetime ban from West Indian cricket. Wynter later emigrated to the United States, and played for the U.S. national team at the 1990 ICC Trophy.",
        "rank": 3,
        "supporting": false
      },
      {
        "id": 89,
        "title": "1998 ICC KnockOut Trophy Final",
        "text": "The 1998 ICC KnockOut Trophy (officially known as Wills International Cup, also known as Mini World Cup) was a One Day International (ODI) cricket tournament held in Bangladesh. It was the first tournament apart from the World Cups to involve all Test playing nations. The winners of the Knock-out stage—India, South Africa, Sri Lanka and Indies—reached the semi-finals. South Africa made their way to the final by defeating Sri Lanka in the first semi-final by 92 runs; the match was reduced to 39 overs per innings due to rain. In the second semi-final, West Indies defeated India by six wickets, and qualified for the final.",
        "rank": 4,
        "supporting": false
      },
      {
        "id": 84,
        "title": "1998 ICC KnockOut Trophy squads",
        "text": "These were the nine squads (all Test nations) picked to take part in the 1998 ICC KnockOut Trophy, the first installment of the Champions Trophy cricket tournament. The tournament was held in Bangladesh from 24 October to 2 November 1998. Teams could name a preliminary squad of 30, but only 14-man squads were permitted for the actual tournament, one month before the start of the tournament. In the knockout tournament, New Zealand and Zimbabwe were the only teams to play a pre-quarter final match. New Zealand won the match and qualified for the quarter-final where they faced Sri Lanka. South Africa won the inaugural edition of the ICC KnockOut Trophy by defeating West Indies in the final by four wickets.",
        "rank": 5,
        "supporting": false
      },
      {
        "id": 86,
        "title": "Peter Kingston-Davey",
        "text": "Peter William Kingston-Davey (22 October 1940) is a former English cricket umpire from Tiverton, Devon. In 1995, Kingston-Davey first stood as an umpire in a Minor Counties Championship match between Dorset and Wales Minor Counties. Two years later he stood in his first MCCA Knockout Trophy match, played between Dorset and Wales Minor Counties. He stood in his first List A match in the 1999 NatWest Trophy played between Devon and Berkshire. Between 1999 and 2003 he stood in 5 List A matches, the last of which he stood in was between Devon and Suffolk in the 1st round of the 2004 Cheltenham & Gloucester Trophy which was held in 2003. Peter-Kingston stood as an umpire in Minor counties cricket until 2006, by which time he had stood in 39 Minor Counties Championship matches and 15 MCCA Knockout Trophy matches.",
        "rank": 7,
        "supporting": false
      },
      {
        "id": 93,
        "title": "Stafanie Taylor",
        "text": "Stafanie Roxann Taylor, OD (born 11 June 1991) is a Jamaican cricketer who is current captain of West Indies women's cricket team. She has represented West Indies women's cricket team over 80 times since her debut in 2008. A right-handed batsman and off break bowler, Taylor was selected as the 2011 ICC Women's Cricketer of the Year – the first West Indian to receive the accolade. Born in Jamaica, Taylor broke into the West Indies team in 2008, aged 17, and immediately inserted herself as a key member of the team. She scored her highest Twenty20 total on debut, striking 90 runs from 49 balls to help her side to a large victory. In the 2016 World Twenty20, she was the highest run-scorer and named player of the series. She played in her 100th Women's One Day International (WODI) match, when the West Indies played India in the group stage of the 2017 Women's Cricket World Cup, on 29 June 2017.",
        "rank": 8,
        "supporting": false
      }
    ],
    "edges": {
      "S": [
        [
          85,
          91
        ],
        [
          91,
          87
        ]
      ],
      "R": [
        [
          85,
          91
        ],
        [
          91,
          87
        ]
      ],
      "N": [
        [
          85,
          91
        ],
        [
          85,
          87
        ],
        [
          85,
          88
        ],
        [
          85,
          89
        ],
        [
          85,
          84
        ],
        [
          85,
          93
        ],
        [
          91,
          87
        ],
        [
          91,
          89
        ],
        [
          91,
          84
        ],
        [
          87,
          89
        ],
        [
          87,
          84
        ],
        [
          88,
          89
        ],
        [
          88,
          84
        ],
        [
          88,
          93
        ],
        [
          89,
          84
        ],
        [
          89,
          93
        ],
        [
          84,
          93
        ]
      ],
      "K": [
        [
          85,
          91
        ],
        [
          85,
          88
        ],
        [
          85,
          93
        ],
        [
          91,
          87
        ],
        [
          91,
          89
        ],
        [
          91,
          84
        ],
        [
          87,
          89
        ],
        [
          87,
          84
        ],
        [
          88,
          93
        ],
        [
          89,
          84
        ]
      ]
    }
  },
  {
    "id": "the-newcomers",
    "label": "The Newcomers",
    "dataset": "HotpotQA",
    "question": "What is one of the stars of The Newcomers known for?",
    "nodes": [
      {
        "id": 1,
        "title": "Chris Evans (actor)",
        "text": "Christopher Robert Evans (born June 13, 1981) is an American actor and filmmaker. Evans is known for his superhero roles as the Marvel Comics characters Steve Rogers / Captain America in the Marvel Cinematic Universe and Johnny Storm / Human Torch in \"Fantastic Four\" and .",
        "rank": 221,
        "supporting": true
      },
      {
        "id": 7,
        "title": "The Newcomers (film)",
        "text": "The Newcomers is a 2000 American family drama film directed by James Allen Bradley and starring Christopher McCoy, Kate Bosworth, Paul Dano and Chris Evans. Christopher McCoy plays Sam Docherty, a boy who moves to Vermont with his family, hoping to make a fresh start away from the city. It was filmed in Vermont, and released by Artist View Entertainment and MTI Home Video.",
        "rank": 1,
        "supporting": true
      },
      {
        "id": 9514,
        "title": "The Newcomer in The Cabbage",
        "text": "The Newcomer in The Cabbage (Russian: Пришелец в капусте ) is a 1989 short Soviet Russian stop-motion animation film by Vladimir Danilevich. It is the first film of a tetralogy about the adventures of The Newcomer Vaniusha and his friends. It was followed by \"Vaniusha The Newcomer\", \"Vaniusha and The Space Pirate\" and \"Vaniusha and The Giant\".",
        "rank": 2,
        "supporting": false
      },
      {
        "id": 9515,
        "title": "Vaniusha The Newcomer",
        "text": "Vaniusha The Newcomer (Russian: Пришелец Ванюша ) is a 1990 Soviet Russian stop-motion animation film by Vladimir Danilevich and Olga Panokina. It was produced by Soyuzmultfilm studio. <br>The film is about The Friendly Newcomer from another planet.<br> It is the second film of the tetralogy, which tells about the adventures of The Newcomer Vaniusha and his friends. The other three films are \"The Newcomer in The Cabbage\", \"Vaniusha and The Space Pirate\" and \"Vaniusha and The Giant\".",
        "rank": 3,
        "supporting": false
      },
      {
        "id": 5114,
        "title": "An American Girl: McKenna Shoots for the Stars",
        "text": "An American Girl: McKenna Shoots for the Stars (released in PAL territories as American Girl: Shooting for the Stars) is a 2012 American family-drama film starring actress Jade Pettyjohn, Ysa Penarejo, Cathy Rigby, Nia Vardalos, and Ian Ziering. This film is based on the \"McKenna\" books in the American Girl series written by Mary Casanova. The film is also the second in the series to feature a Girl of the Year character, the first being \"\", and is the sixth film in the \"American Girl\" series overall.",
        "rank": 4,
        "supporting": false
      },
      {
        "id": 9513,
        "title": "Vaniusha and The Giant",
        "text": "Vaniusha and The Giant (Russian: Ванюша и великан ) is a 1993 Russian stop-motion animation film by Vladimir Danilevich. This film was produced by Soyuzmultfilm studio. <br>The film is about The Friendly Newcomer from another planet.<br> The film is the fourth film of the tetralogy, which tells about the adventures of The Newcomer Vaniusha and his friends. The first three films are \"The Newcomer in The Cabbage\", \"Vaniusha The Newcomer\" and \"Vaniusha and The Space Pirate\".",
        "rank": 5,
        "supporting": false
      },
      {
        "id": 9512,
        "title": "Vaniusha and The Space Pirate",
        "text": "Vaniusha and The Space Pirate (Russian: Ванюша и космический пират ) is a 1991 Soviet Russian stop-motion animation film by Vladimir Danilevich. This film was produced by Soyuzmultfilm studio. <br>The film is about The Friendly Newcomer from another planet.<br> The film is The Third Film of the tetralogy, which tells about the adventures of The Newcomer Vaniusha and his friends. Other three films called \"The Newcomer in The Cabbage\", \"Vaniusha The Newcomer\" and \"Vaniusha and The Giant\".",
        "rank": 6,
        "supporting": false
      },
      {
        "id": 3701,
        "title": "Ronald Humarang",
        "text": "Ronald Jaimeer C. Humarang (born December 15, 1994 in Agoncillo, Batangas, Philippines) is a Filipino singer and actor. His career started when he joined \"Little Big Star\" where became a major part of the Big Division of Little Big Star Season I, along with the likes of Sam Concepcion and Charice Pempengco. He has also been part of the Little Big Star’s album with his own rendition of \"Iisa Lang Tayo\". He did not make it to the top this time. He auditioned for Little Big Superstar, the spin-off of Little Big Star, wherein he emerged as the \"First Honor\" or the \"Champion\".",
        "rank": 7,
        "supporting": false
      },
      {
        "id": 7095,
        "title": "Rebecca Gibney",
        "text": "Rebecca Catherine Gibney (born 14 December 1964) is a New Zealand actress known for her roles on Australian television in \"The Flying Doctors\", \"Halifax f.p.\", \"Packed to the Rafters\", \"Winter\" and \"Wanted\". She is a Gold Logie winner and has featured in a number of Australian films including \"Mental\" and \"The Dressmaker\".",
        "rank": 8,
        "supporting": false
      }
    ],
    "edges": {
      "S": [
        [
          1,
          7
        ],
        [
          9514,
          9515
        ],
        [
          9514,
          9513
        ],
        [
          9514,
          9512
        ],
        [
          9515,
          9513
        ],
        [
          9515,
          9512
        ],
        [
          9513,
          9512
        ]
      ],
      "R": [
        [
          9514,
          9515
        ],
        [
          9514,
          9513
        ],
        [
          9514,
          9512
        ],
        [
          9515,
          9513
        ],
        [
          9515,
          9512
        ],
        [
          9513,
          9512
        ]
      ],
      "N": [
        [
          9514,
          9515
        ],
        [
          9514,
          9513
        ],
        [
          9514,
          9512
        ],
        [
          9515,
          9513
        ],
        [
          9515,
          9512
        ],
        [
          9513,
          9512
        ]
      ],
      "K": [
        [
          9514,
          9515
        ],
        [
          9514,
          9513
        ],
        [
          9514,
          9512
        ],
        [
          9515,
          9513
        ],
        [
          9515,
          9512
        ],
        [
          9513,
          9512
        ]
      ]
    }
  },
  {
    "id": "erik-hort",
    "label": "Erik Hort",
    "dataset": "MuSiQue",
    "question": "What county is Erik Hort's birthplace a part of?",
    "nodes": [
      {
        "id": 44,
        "title": "Montebello, New York",
        "text": "Montebello (Italian: \"Beautiful mountain\") is an incorporated village in the town of Ramapo, Rockland County, New York, United States. It is located north of Suffern, east of Hillburn, south of Wesley Hills, and west of Airmont. The population was 4,526 at the 2010 census.",
        "rank": 894,
        "supporting": true
      },
      {
        "id": 59,
        "title": "Erik Hort",
        "text": "Erik Hort (born February 16, 1987 in Montebello, New York) is an American soccer player who is currently a Free Agent.",
        "rank": 1,
        "supporting": true
      },
      {
        "id": 720,
        "title": "Ingmar Bergman",
        "text": "Ernst Ingmar Bergman was born on 14 July 1918 in Uppsala, Sweden, the son of Erik Bergman, a Lutheran minister and later chaplain to the King of Sweden, and Karin (\"née\" Åkerblom), a nurse who also had Walloon ancestors. He grew up with his older brother Dag and sister Margareta surrounded by religious imagery and discussion. His father was a conservative parish minister with strict ideas of parenting. Ingmar was locked up in dark closets for infractions such as wetting the bed. \"While father preached away in the pulpit and the congregation prayed, sang, or listened\", Ingmar wrote in his autobiography \"Laterna Magica\",",
        "rank": 2,
        "supporting": false
      },
      {
        "id": 48,
        "title": "Långe Erik",
        "text": "Långe Erik (\"Tall Erik\"), official name Ölands norra udde, is a Swedish lighthouse built in 1845 and located on a little island, Stora Grundet (in Böda socken, Borgholm Municipality), in Grankullaviken bay at the north point of Öland, the second largest island in Sweden. The island is connected to Öland by a small bridge built in 1965.",
        "rank": 3,
        "supporting": false
      },
      {
        "id": 9875,
        "title": "Leonhard Seppala",
        "text": "Leonhard Seppala was born in the village of Skibotn in Storfjord municipality, Troms county, Norway. He was the oldest-born child of father Isak Isaksson Seppälä (of Swedish descent) and Anne Henriksdatter (of Finnish Norwegian Kven descent). His father's family name is of Finnish origin. When Seppala was two years old, his family moved within Troms county to nearby Skjervøy municipality on the island of Skjervøya. While in Skjervøy, his father worked as a blacksmith and fisherman, building up a relatively large estate. Seppala initially followed in his father's footsteps as both a blacksmith and a fisherman. However, he emigrated to Alaska during the Nome gold rush of the 1900s. His friend Jafet Lindeberg had returned from Alaska and convinced Seppala to come to work for his mining company in Nome.",
        "rank": 4,
        "supporting": false
      },
      {
        "id": 7832,
        "title": "Niels Juel",
        "text": "Niels Juel was born the son of Erik Juel and Sophie Sehested, both of whom were descended from Danish nobility, who lived in Jutland where the father had a career as a local functionary and judge. He was the brother of the diplomat Jens Juel (1631–1700). Niels Juel was born in Christiania, Norway, where his family sought refuge during the 1627 invasion of Jutland during the Thirty Years' War, while his father took part in the defense of the country at home. The following year after the occupation had ended, the family was reunited in Jutland. From 1635 to 1642, Juel was brought up by his aunt Karen Sehested (1606–1672) at the Stenalt estate near Randers.",
        "rank": 5,
        "supporting": false
      },
      {
        "id": 3861,
        "title": "Marina Kulik",
        "text": "Kulik frequently has solo exhibitions all over Europe (England, Italy, Romania, Belgium, Sweden) and especially in galleries in France (Vence, Cannes, Paris, Nice), and her home country the Netherlands (Amsterdam, Rotterdam, The Hague, Hilversum). She also exhibited in the United States (Seattle). For her abstracts she is represented by Gallery Oscar (Nice).",
        "rank": 77,
        "supporting": false
      },
      {
        "id": 9612,
        "title": "Rockefeller Center Christmas Tree",
        "text": "Year Original location Tree type Height Lighting 2017 State College, PA Norway spruce 75 ft November 29, 2017 2016 Oneonta, NY Norway spruce 94 ft November 30, 2016 2015 Gardiner, NY Norway spruce 78 ft December 2, 2015 2014 Danville, PA Norway spruce 85 ft December 3, 2014 2013 Shelton, CT Norway spruce 76 ft December 4, 2013 2012 Flanders, NJ Norway spruce 80 ft November 28, 2012 2011 Mifflinville, PA Norway spruce 74 ft November 30, 2011 Mahopac, NY Norway spruce 74 ft November 30, 2010 2009 Easton, CT Norway spruce 76 ft December 2, 2009 2008 Hamilton, NJ Norway spruce 72 ft December 3, 2008 2007 Shelton, CT Norway spruce 84 ft November 28, 2007 2006 Ridgefield, CT Norway spruce 88 ft November 29, 2006 2005 Wayne, NJ Norway spruce 74 ft November 30, 2005 Suffern, NY Norway spruce 71 ft November 30, 2004 2003 Manchester, CT Norway spruce 79 ft December 3, 2003 2002 Bloomsbury, NJ Norway spruce 76 ft December 4, 2002 Wayne, NJ Norway spruce 81 ft November 28, 2001 2000 Buchanan, NY Norway spruce 80 ft November 29, 2000 1999 Killingworth, CT Norway spruce 100 ft * December 1, 1999 1998 Richfield, OH Norway spruce 75 ft December 2, 1998 Stony Point, NY Norway spruce 70 ft December 2, 1997 Armonk, NY Norway spruce 90 ft December 3, 1996 1995 Mendham, NJ Norway spruce 75 ft December 5, 1995 Ridgefield, CT Norway spruce 85 ft December 2, 1994 Montebello, NY Norway spruce 70 ft 1986 Nanuet, NY Norway spruce 68 ft 1980 Mahwah, NJ Norway spruce 70 ft 1978 Mahwah, NJ Norway spruce 75 ft 1963 Rockaway, NJ Bruce Fir, Veit 84 ft 1957 Brighton, VT White spruce 67 ft",
        "rank": 427,
        "supporting": false
      },
      {
        "id": 1287,
        "title": "United States",
        "text": "The United States of America (USA), commonly known as the United States (U.S.) or America, is a federal republic composed of 50 states, a federal district, five major self - governing territories, and various possessions. At 3.8 million square miles (9.8 million km) and with over 325 million people, the United States is the world's third - or fourth - largest country by total area and the third-most populous. The capital is Washington, D.C., and the largest city by population is New York City. Forty - eight states and the capital's federal district are contiguous and located in North America between Canada and Mexico. The state of Alaska is in the northwest corner of North America, bordered by Canada to the east and across the Bering Strait from Russia to the west. The state of Hawaii is an archipelago in the mid-Pacific Ocean. The U.S. territories are scattered about the Pacific Ocean and the Caribbean Sea, stretching across nine official time zones. The extremely diverse geography, climate, and wildlife of the United States make it one of the world's 17 megadiverse countries.",
        "rank": null,
        "supporting": false
      },
      {
        "id": 4686,
        "title": "Branch Brook Park",
        "text": "Branch Brook Park is a county park of Essex County, New Jersey in the United States, located in the North Ward of Newark, between the neighborhoods of Forest Hill and Roseville. A portion of the park is also located within the Township of Belleville. At , Branch Brook Park is the largest public park in the city of Newark. The park is noted for the largest collection of cherry blossom trees in the United States, having over 5,000 in more than eighteen different varieties collectively called Cherryblossomland, as well as its spectacular Cherry Blossom Festival each April.",
        "rank": 147,
        "supporting": false
      }
    ],
    "edges": {
      "S": [],
      "R": [
        [
          44,
          59
        ],
        [
          44,
          1287
        ],
        [
          3861,
          1287
        ],
        [
          1287,
          4686
        ]
      ],
      "N": [
        [
          59,
          9612
        ]
      ],
      "K": [
        [
          9875,
          7832
        ],
        [
          9612,
          4686
        ]
      ]
    }
  },
  {
    "id": "southeast-library",
    "label": "Southeast Library",
    "dataset": "MuSiQue",
    "question": "Where does the body of water by the city where the Southeast Library designer died empty into the Gulf of Mexico?",
    "nodes": [
      {
        "id": 119,
        "title": "Riverside Plaza",
        "text": "Riverside Plaza is a modernist and brutalist apartment complex designed by Ralph Rapson that opened in Minneapolis, Minnesota in 1973. Situated on the edge of downtown Minneapolis in the Cedar-Riverside neighborhood, and next to both the University of Minnesota's West Bank and Augsburg University, the site contains the 39-story McKnight Building, the tallest structure outside of the city's central business district. Initially known as Cedar Square West, exterior shots of the complex were featured on television as the residence of Mary Richards in sixth and seventh seasons of \"The Mary Tyler Moore Show\".",
        "rank": 309,
        "supporting": true
      },
      {
        "id": 120,
        "title": "Mississippi River",
        "text": "The Mississippi River is the chief river of the second - largest drainage system on the North American continent, second only to the Hudson Bay drainage system. Flowing entirely in the United States (although its drainage basin reaches into Canada), it rises in northern Minnesota and meanders slowly southwards for 2,320 miles (3,730 km) to the Mississippi River Delta at the Gulf of Mexico. With its many tributaries, the Mississippi's watershed drains all or parts of 31 U.S. states and 2 Canadian provinces between the Rocky and Appalachian Mountains. The Mississippi ranks as the fourth - longest and fifteenth - largest river in the world by discharge. The river either borders or passes through the states of Minnesota, Wisconsin, Iowa, Illinois, Missouri, Kentucky, Tennessee, Arkansas, Mississippi, and Louisiana.",
        "rank": 173,
        "supporting": true
      },
      {
        "id": 124,
        "title": "Minneapolis",
        "text": "Minneapolis lies on both banks of the Mississippi River, just north of the river's confluence with the Minnesota River, and adjoins Saint Paul, the state's capital. The city is abundantly rich in water, with 13 lakes, wetlands, the Mississippi River, creeks and waterfalls; many connected by parkways in the Chain of Lakes and the Grand Rounds National Scenic Byway. It was once the world's flour milling capital and a hub for timber. The city and surrounding region is the primary business center between Chicago and Seattle. As of 2018, Minneapolis was home to 6 Fortune 500 companies, and the Twin Cities were the fifth-largest hub of major corporate headquarters in the United States. As an integral link to the global economy, Minneapolis is categorized as a global city.",
        "rank": 291,
        "supporting": true
      },
      {
        "id": 133,
        "title": "Southeast Library",
        "text": "Southeast Library's building was designed by master architect Ralph Rapson and originally functioned as a credit union for university and state employees. It opened as a library in 1967. The State Capitol Credit Union building at 1222 Fourth Street Southeast was purchased to be converted into a library on December 29, 1966. It opened as the new Southeast Library on December 26, 1967.",
        "rank": 1,
        "supporting": true
      },
      {
        "id": 6245,
        "title": "WaterColor, Florida",
        "text": "WaterColor is an unincorporated master-planned community located in Seagrove Beach on the Northwest Gulf Coast of Florida, United States near Destin. This Southern resort and residential community was planned by Cooper, Robertson & Partners, under the direction of The St. Joe Company. The St. Joe Company has owned the land since 1927. WaterColor is located in Walton County.",
        "rank": 2,
        "supporting": false
      },
      {
        "id": 122,
        "title": "Gulf of Mexico",
        "text": "The Gulf of Mexico (Spanish: Golfo de México) is an ocean basin and a marginal sea of the Atlantic Ocean,  largely surrounded by the North American continent. It is bounded on the northeast, north and northwest by the Gulf Coast of the United States, on the southwest and south by Mexico, and on the southeast by Cuba. The U.S. states of Texas, Louisiana, Mississippi, Alabama, and Florida border the Gulf on the north, which are often referred to as the \"Third Coast\", in comparison with the U.S. Atlantic and Pacific coasts.",
        "rank": 3,
        "supporting": false
      },
      {
        "id": 7174,
        "title": "Mexico Beach, Florida",
        "text": "Mexico Beach is a city in Bay County, Florida, United States. It is located southeast of Panama City. The population was 1,072 at the 2010 census. The community was extensively damaged by Hurricane Michael on October 10, 2018. The Federal Emergency Management Agency (FEMA) declared the community \"wiped out\" in the aftermath of the hurricane's devastating impact.",
        "rank": 4,
        "supporting": false
      },
      {
        "id": 128,
        "title": "Colorado River (Texas)",
        "text": "Its drainage basin and some of its usually dry tributaries extend into New Mexico. It flows generally southeast from Dawson County through Ballinger, Marble Falls, Austin, Bastrop, Smithville, La Grange, Columbus, Wharton, and Bay City before emptying into the Gulf of Mexico at Matagorda Bay.",
        "rank": 5,
        "supporting": false
      },
      {
        "id": 125,
        "title": "Gulf of Mexico",
        "text": "The Gulf of Mexico formed approximately 300 million years ago as a result of plate tectonics. The Gulf's basin is roughly oval and is approximately 810 nautical miles (1,500 km; 930 mi) wide and floored by sedimentary rocks and recent sediments. It is connected to part of the Atlantic Ocean through the Florida Straits between the U.S. and Cuba, and with the Caribbean (with which it forms the American Mediterranean Sea) via the Yucatán Channel between Mexico and Cuba. With the narrow connection to the Atlantic, the Gulf experiences very small tidal ranges. The size of the Gulf basin is approximately 1.6 million km (615,000 sq mi). Almost half of the basin is shallow continental shelf waters. The basin contains a volume of roughly 2,500 quadrillion liters (550 quadrillion Imperial gallons, 660 quadrillion US gallons, 2.5 million km or 600,000 cu mi).",
        "rank": 6,
        "supporting": false
      },
      {
        "id": 10031,
        "title": "Gulf of Mexico",
        "text": "The Gulf of Mexico formed approximately 300 million years ago as a result of plate tectonics. The Gulf of Mexico basin is roughly oval and is approximately 810 nautical miles (1,500 km; 930 mi) wide and floored by sedimentary rocks and recent sediments. It is connected to part of the Atlantic Ocean through the Florida Straits between the U.S. and Cuba, and with the Caribbean Sea (with which it forms the American Mediterranean Sea) via the Yucatán Channel between Mexico and Cuba. With the narrow connection to the Atlantic, the Gulf experiences very small tidal ranges. The size of the Gulf basin is approximately 1.6 million km (615,000 sq mi). Almost half of the basin is shallow continental shelf waters. The basin contains a volume of roughly 2,500 quadrillion liters (550 quadrillion Imperial gallons, 660 quadrillion US gallons, 2.5 million km or 600,000 cu mi). The Gulf of Mexico is one of the most important offshore petroleum production regions in the world, comprising one - sixth of the United States' total production.",
        "rank": 7,
        "supporting": false
      }
    ],
    "edges": {
      "S": [],
      "R": [
        [
          119,
          124
        ],
        [
          120,
          124
        ],
        [
          120,
          122
        ],
        [
          120,
          125
        ],
        [
          120,
          10031
        ],
        [
          122,
          128
        ],
        [
          122,
          125
        ],
        [
          122,
          10031
        ],
        [
          128,
          125
        ],
        [
          128,
          10031
        ],
        [
          125,
          10031
        ]
      ],
      "N": [
        [
          119,
          133
        ],
        [
          120,
          122
        ],
        [
          120,
          128
        ],
        [
          120,
          125
        ],
        [
          120,
          10031
        ],
        [
          122,
          128
        ],
        [
          122,
          125
        ],
        [
          122,
          10031
        ],
        [
          128,
          125
        ],
        [
          128,
          10031
        ],
        [
          125,
          10031
        ]
      ],
      "K": [
        [
          122,
          128
        ],
        [
          122,
          125
        ],
        [
          122,
          10031
        ],
        [
          125,
          10031
        ]
      ]
    }
  }
];
