(function (TBUtils) {
    var fooObjects = [];
    for(var key in window) {
        if (window[key] === TBUtils) {
            fooObjects.push(window[key]);
           console.log(window[key])
        }
    }
    
    console.log(fooObjects.length)
    
    
    console.log('tbutils loaded');
    //Private variables
    var mySubs = [],
        modMineURL = 'http://www.reddit.com/subreddits/mine/moderator.json?count=100',
        lastget = JSON.parse(localStorage['Toolbox.cache.lastget'] || -1),
        cachename = localStorage['Toolbox.cache.cachename'] || '';
        
    // Public variables
    TBUtils.version = 1;
    TBUtils.NO_WIKI_PAGE = 'NO_WIKI_PAGE';
    TBUtils.WIKI_PAGE_UNKNOWN = 'WIKI_PAGE_UNKNOWN';
    TBUtils.isModmail = location.pathname.match(/\/message\/(?:moderator)\/?/);
    TBUtils.isModpage = location.pathname.match(/\/about\/(?:reports|modqueue|spam|unmoderated|trials)\/?/),
    TBUtils.isEditUserPage = location.pathname.match(/\/about\/(?:contributors|moderator|banned)\/?/),
    TBUtils.noteCache = [],
    TBUtils.configCache = [],
    TBUtils.noConfig = [],
    TBUtils.noNotes = [];

    TBUtils.usernotes = {
        ver: 1,
        users: [] //typeof userNotes
    };

    TBUtils.note = {
        note: '',
        time: '',
        mod: '',
        link: ''
    };

    TBUtils.config = {
        ver: 1,
        domainTags: '',
        removalReasons: '',
        modMacros: '',
    };

    //Private functions
    TBUtils.getModSubs = function(callback) {

        if (localStorage['Toolbox.cache.moderatedsubs']) {
            mySubs = JSON.parse(localStorage['Toolbox.cache.moderatedsubs']);
        }

        // If it has been more than ten minutes, refresh mod cache.
        if (mySubs.length < 1 || (new Date().getTime() - lastget) / (1000 * 60) > 30 || cachename != reddit.logged) {
            mySubs = []; //resent list.
            getSubs(modMineURL);
        } else {
            mySubs = TBUtils.saneSort(mySubs);

            // Go!
            callback(mySubs);
        }

        function getSubs(URL) {
            $.getJSON(URL, function (json) {
                getSubsResult(json.data.children, json.data.after);
            });
        }

        // Callback because reddits/mod/mine is paginated.
        function getSubsResult(subs, after) {
            $(subs).each(function (sub) {
                mySubs.push(this.data.display_name.trim());
            });

            if (after) {
                var URL = modMineURL + '&after=' + after;
                getSubs(URL);
            } else {
                // We have all our subs.  Start adding ban links.
                lastget = new Date().getTime();
                cachename = reddit.logged;

                mySubs = TBUtils.saneSort(mySubs);

                // Update the cache.
                localStorage['Toolbox.cache.moderatedsubs'] = JSON.stringify(mySubs);
                localStorage['Toolbox.cache.lastget'] = JSON.stringify(lastget);
                localStorage['Toolbox.cache.cachename'] = cachename;

                // Go!
                callback(mySubs);
            }
        }

    };

    // Because normal .sort() is case sensitive.
    TBUtils.saneSort = function(arr) {
        return arr.sort(function (a, b) {
            if (a.toLowerCase() < b.toLowerCase()) return -1;
            if (a.toLowerCase() > b.toLowerCase()) return 1;
            return 0;
        });
    };

    TBUtils.getThingInfo = function(thing, modCheck) {

        var user = $(thing).find('.author:first').text(),
            subreddit = $('.titlebox h1.redditname a').text(),
            permalink = $(thing).closest('.entry').find('a.bylink').attr('href');
            
        if (TBUtils.isEditUserPage && !user) {
            user = $(thing).closest('.user').find('a:first').text();
        }

        // Try again.
        if (!user) {
            user = $(thing).closest('.entry').find('.author:first').text();
        }

        // Might be a submission.
        if (!permalink) {
            permalink = $(thing).closest('.entry').find('a.comments').attr('href');
        }

        if (!subreddit) {
            subreddit = $(thing).closest('.entry').find('.subreddit').text();
        }

        if (!subreddit) {
            subreddit = $(thing).closest('.thing').find('.subreddit').text();
        }

        // If we still don't have a sub, we're in mod mail
        if (!subreddit) {
            subreddit = $(thing).find('.head a:last').text().replace('/r/', '').replace('/', '').trim();

            //user: there is still a chance that this is mod mail, but we're us.
            //This is a weird palce to go about this, and the conditions are strange,
            //but if we're going to assume we're us, we better make damned well sure that is likely the case.
            if (!user && $(thing).find('.remove-button').text() === '') {
                user = reddit.logged;

                if (!subreddit) {
                    // Find a better way, I double dog dare ya!
                    subreddit = $(thing).closest('.message-parent').find('.correspondent.reddit.rounded a').text()
                        .replace('/r/', '').replace('[-]', '').replace('[+]', '').trim();
                }
            }
        }

        // Not a mod, reset current sub.
        if (modCheck && $.inArray(subreddit, mySubs) === -1) {
            subreddit = '';
        }

        if (user == '[deleted]') {
            user = '';
        }

        return {
            subreddit: subreddit,
            user: user,
            permalink: permalink
        };
    };

    // Prevent page lock while parsing things.  (stolen from RES)
    TBUtils.forEachChunked = function(array, chunkSize, delay, call, complete) {
        if (array == null) return;
        if (chunkSize == null || chunkSize < 1) return;
        if (delay == null || delay < 0) return;
        if (call == null) return;
        var counter = 0;
        var length = array.length;

        function doChunk() {
            for (var end = Math.min(array.length, counter + chunkSize); counter < end; counter++) {
                var ret = call(array[counter], counter, array);
                if (ret === false) return;
            }
            if (counter < array.length) {
                window.setTimeout(doChunk, delay);
            } else {
                if (complete) complete();
            }
        }
        window.setTimeout(doChunk, delay);
    };

    TBUtils.postToWiki = function(page, subreddit, data, isJSON, updateAM, callback) {

        if (isJSON) {
            data = JSON.stringify(data, undefined, 2);
        }

        $.post('/r/' + subreddit + '/api/wiki/edit', {
            content: data,
            page: page,
            reason: 'updated via toolbox config',
            uh: reddit.modhash
        })

        .error(function (err) {
            callback(false, err.responseText);
        })

        .success(function () {
            // Callback regardless of what happens next.  We wrote to the page.
            callback(true);

            if (updateAM) {
                $.post('/api/compose', {
                    to: 'automoderator',
                    uh: reddit.modhash,
                    subject: subreddit,
                    text: 'update'
                })
                    .success(function () {
                        alert('sucessfully sent update PM to automoderator');
                    })
                    .error(function () {
                        alert('error sending update PM to automoderator');
                        window.location = 'http://www.reddit.com/message/compose/?to=AutoModerator&subject=' + subreddit + '&message=update';
                    });
            }

            setTimeout(function () {

                // hide the page
                $.post('/r/' + subreddit + '/wiki/settings/' + page, {
                    permlevel: 2,
                    uh: reddit.modhash
                })

                // Super extra double-secret secure, just to be safe.
                .error(function (err) {
                    alert('error setting wiki page to mod only access');
                    window.location = 'http://www.reddit.com/r/' + subreddit + '/wiki/settings/' + page;
                });

            }, 500);
        });
    };

    TBUtils.readFromWiki = function(subreddit, page, isJSON, callback) {

        $.getJSON('http://www.reddit.com/r/' + subreddit + '/wiki/' + page + '.json', function (json) {
            var wikiData = json.data.content_md;

            if (!wikiData) {
                callback(TBUtils.NO_WIKI_PAGE);
                return;
            }

            if (isJSON) {
                wikiData = JSON.parse(wikiData);
                if (wikiData) {
                    callback(wikiData);
                } else {
                    callback(TBUtils.NO_WIKI_PAGE);
                }
                return;
            }

            // We have valid data, but it's not JSON.
            callback(wikiData);
            return;

        }).error(function (e) {
            var reason = JSON.parse(e.responseText).reason || '';
            if (reason == 'PAGE_NOT_CREATED' || reason == 'WIKI_DISABLED') {
                callback(TBUtils.NO_WIKI_PAGE);
            } else {
                // we don't know why it failed, we should not try to write to it.
                callback(TBUtils.WIKI_PAGE_UNKNOWN);
            }
        });
    };

    TBUtils.compressHTML = function(src) {
        return src.replace(/(\n+|\s+)?&lt;/g, '<').replace(/&gt;(\n+|\s+)?/g, '>').replace(/&amp;/g, '&').replace(/\n/g, '').replace(/child" >  False/, 'child">');
    };

}(TBUtils = window.TBUtils || {}));
