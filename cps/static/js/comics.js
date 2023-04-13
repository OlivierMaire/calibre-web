/*
 * comics.js
 *
 * Licensed under the MIT License
 *
 * Copyright(c) 2022 oliviermaire
*/

/* 
** Inspired by kthoom.js
*/

if (window.opera) {
    window.console.log = function (str) {
        opera.postError(str);
    };
}

(function ($) {
    "use strict";

    const // key codes
        KEYS = {
            ESCAPE: 27,
            SPACE: 32,
            LEFT: 37,
            UP: 38,
            RIGHT: 39,
            DOWN: 40,
            A: 65, B: 66, C: 67, D: 68, E: 69, F: 70, G: 71, H: 72, I: 73, J: 74, K: 75, L: 76, M: 77,
            N: 78, O: 79, P: 80, Q: 81, R: 82, S: 83, T: 84, U: 85, V: 86, W: 87, X: 88, Y: 89, Z: 90,
            QUESTION_MARK: 191,
            LEFT_SQUARE_BRACKET: 219,
            RIGHT_SQUARE_BRACKET: 221,
            NUM1: 49, NUM2: 50,
            F11: 122
        };

    // gets the element with the given id
    function getElem(id) {
        if (document.documentElement.querySelector) {
            // querySelector lookup
            return document.body.querySelector("#" + id);
        }
        // getElementById lookup
        return document.getElementById(id);
    }

    var ComicsReader = function (element, options) {
        this.options = options;
        this.$element = $(element);
    };

    ComicsReader.prototype = {

        constructor: function () {
            this.bookmarkUrl = "";
            this.fetchPagesUrl = "";
            this.bookInfo = {};
            this.pageInfo = [];
            var _currentPage = 0;
            Object.defineProperty(this, 'currentPage', {
                get: function () { return _currentPage; },
                set: function (v) {
                    _currentPage = v;
                    this.updateProgress();
                }
            });



            if (!this.options.bookInfoUrl) {
                throw ("ComicsReader: bookInfoUrl not set in options.");
            }

            this.$elem = this.$element;
            // access settings with this.options...
            this.$elem.addClass(this.options.mainClassName).addClass("comics-reader-app");


            this.preferences = {
            };

            this.loadPreferences();

            if (!this.preferences.hflip)
                this.preferences.hflip = false;
            if (!this.preferences.vflip)
                this.preferences.vflip = false;
            if (!this.preferences.rotateTimes)
                this.preferences.rotateTimes = 0;
            if (!this.preferences.fitMode)
                this.preferences.fitMode = KEYS.B;
            if (!this.preferences.theme)
                this.preferences.theme = "light";
            if (!this.preferences.direction)
                this.preferences.direction = 0; // 0 = Left to Right, 1 = Right to Left
            if (!this.preferences.nextPage)
                this.preferences.nextPage = 0; // 0 = Reset to Top, 1 = Remember Position
            if (!this.preferences.scrollbar && this.preferences.scrollbar != 0)
                this.preferences.scrollbar = 1; // 0 = Hide Scrollbar, 1 = Show Scrollbar
            if (!this.preferences.pageMode)
                this.preferences.pageMode = 1;
            if (!this.preferences.preloadPageNb)
                this.preferences.preloadPageNb = 2;
            if (!this.preferences.forceRotationDetection)
                this.preferences.forceRotationDetection = 0;
            if (!this.preferences.autoBackground)
                this.preferences.autoBackground = 0;
            if (!this.preferences.pageShadow)
                this.preferences.pageShadow = 0;

            // build initial DOM
            this.initDom();
            this.setTheme();

            this.savePreferences();
            this.applyScrollbarSettings();


            this.initEvents();


            // load the book

            this.loadBookInfo().then(() => {

                console.debug("book loaded, running validations.");

                if (!this.fetchPagesUrl) {
                    throw ("ComicsReader: page_url missing from downloaded info.");
                }

                this.useBookmarks = false;
                if (this.bookmarkUrl && this.options.useBookmarks == true && this.options.csrfToken) {
                    this.csrfToken = this.options.csrfToken;
                    this.useBookmarks = true;
                    this.currentPage = parseInt(this.options.bookmark);
                }

                this.loadBook();
            });
        },
        initDom: function () {
            // create sidebar for pages list
            var div = document.createElement("div");
            $(div).addClass("pages-list");

            var aside = document.createElement("aside");
            $(aside).addClass("sidebar").addClass("closed");
            $(aside).append(div);

            this.$elem.append(aside);

            var lineProgress = document.createElement("div");
            $(lineProgress).addClass("line-progress");

            var lineProgressWrap = document.createElement("div");
            $(lineProgressWrap).addClass("line-progress-wrap");
            lineProgressWrap.append(lineProgress);

            var title = document.createElement("div");
            $(title).addClass("book-title");

            var menuButton = document.createElement("div");
            $(menuButton).addClass("menu-button").addClass("icon-menu");

            var themeButton = document.createElement("div");
            $(themeButton).addClass("theme-button").addClass("icon-sun");

            var preferencesButton = document.createElement("div");
            $(preferencesButton).addClass("preferences-button").addClass("icon-cog");

            var fullscreenButton = document.createElement("div");
            $(fullscreenButton).addClass("fullscreen-button").addClass("icon-resize-full");

            var menuContent = document.createElement("div");
            $(menuContent).addClass("menu-content");
            $(menuContent).append(menuButton);
            $(menuContent).append(title);
            $(menuContent).append(themeButton);
            $(menuContent).append(preferencesButton);
            $(menuContent).append(fullscreenButton);

            var menu = document.createElement("div");
            $(menu).addClass("menu-bar");
            $(menu).append(lineProgressWrap);
            $(menu).append(menuContent);

            var render = document.createElement("div");
            $(render).addClass("render-view");

            var left = document.createElement("div");
            $(left).addClass("arrow-left").addClass("icon-left-open");

            var right = document.createElement("div");
            $(right).addClass("arrow-right").addClass("icon-right-open");

            var pageProgress = document.createElement("div");
            $(pageProgress).addClass("page-progress");

            var pageView = document.createElement("div");
            $(pageView).addClass("page-view");
            pageView.append(render);
            pageView.append(left);
            pageView.append(right);

            var div = document.createElement("div");
            $(div).addClass("main-view");
            div.append(menu);
            div.append(pageView);
            div.append(pageProgress);

            var modal = this.preferencesDom();

            this.$elem.append(div);
            if (modal !== undefined) {
                this.$elem.append(modal);
            }


        },

        initEvents: function () {
            let self = this;
            this.$elem.find(".preferences-button").click(() =>
                self.$elem.find(".preferences-modal").addClass("md-show")
            );

            this.$elem.find(".modal .closer, .overlay").click(function () {
                self.$elem.find(".preferences-modal").removeClass("md-show");
            });

            this.$elem.find(".menu-button").click(() => {
                self.$elem.find(".sidebar").toggleClass("closed");
                self.$elem.find(".main-view").toggleClass("sidebar-opened");
            }
            );

            this.$elem.find(".arrow-left").click(() =>
                self.leftClicked()
            );
            this.$elem.find(".arrow-right").click(() =>
                self.rightClicked()
            );

            this.$elem.find(".theme-button").click(() => {
                self.preferences.theme = self.preferences.theme == "light" ? "dark" : "light";
                self.savePreferences();
                self.setTheme();
            }
            );


            $(document).keydown(this.keyEvents.bind(this));

            this.screenfull();

            this.$elem.find(".page-progress").hover(
                function () { // handler in
                    $(this).animate({ opacity: 1 }, 250);
                    // Additional actions (display info, etc.)
                }, function () { // handler out
                    $(this).delay(5000).animate({ opacity: 0 }, 2000);
                    // Additional actions (hide info, etc.)
                }
            );

            this.$elem.find(".line-progress-wrap").click((evt) => {
                var offset = $(evt.currentTarget).offset();
                var x = evt.pageX - offset.left;
                var rate = x / $(evt.currentTarget).width();
                self.currentPage = Math.max(1, Math.ceil(rate * self.bookInfo.page_count)) - 1;
                self.loadPageRange().then(() => self.renderPage());
            })



        },
        keyEvents: function (event) {

            var hasModifier = event.ctrlKey || event.shiftKey || event.metaKey;
            switch (event.keyCode) {
                case KEYS.LEFT:
                    if (hasModifier) break;
                    this.leftClicked();
                    break;
                case KEYS.RIGHT:
                    if (hasModifier) break;
                    this.rightClicked();
                    break;
                case KEYS.SPACE:
                    if (event.shiftKey) {
                        event.preventDefault();
                        // If it's Shift + Space and the container is at the top of the page
                        this.gotoPrevPage();
                    } else {
                        event.preventDefault();
                        // If you're at the bottom of the page and you only pressed space
                        this.gotoNextPage();
                    }
                    break;
                case KEYS.F11:
                    if (hasModifier) break;
                    event.preventDefault();
                    this.$elem.find(".fullscreen-button").click();
                    break;
                case KEYS.B:
                    if (hasModifier) break;
                    this.preferences.fitMode = kthoom.Key.B;
                    this.savePreferences();
                    this.applyRenderScale();
                    break;
                case KEYS.W:
                    if (hasModifier) break;
                    this.preferences.fitMode = kthoom.Key.W;
                    this.savePreferences();
                    this.applyRenderScale();
                    break;
                case KEYS.H:
                    if (hasModifier) break;
                    this.preferences.fitMode = kthoom.Key.H;
                    this.savePreferences();
                    this.applyRenderScale();
                    break;
                case KEYS.N:
                    if (hasModifier) break;
                    this.preferences.fitMode = kthoom.Key.N;
                    this.savePreferences();
                    this.applyRenderScale();
                    break;
                case KEYS.L:
                    if (hasModifier) break;
                    this.preferences.rotateTimes--;
                    if (this.preferences.rotateTimes < 0) this.preferences.rotateTimes = 3;
                    this.savePreferences();
                    this.renderPage();
                    break;
                case KEYS.R:
                    if (hasModifier) break;
                    this.preferences.rotateTimes++;
                    if (this.preferences.rotateTimes > 3) this.preferences.rotateTimes = 0;
                    this.savePreferences();
                    this.renderPage();
                    break;
                case KEYS.F:
                    if (hasModifier) break;
                    if (!this.preferences.hflip && !this.preferences.vflip) {
                        this.preferences.hflip = true;
                    } else if (this.preferences.hflip === true && this.preferences.vflip === true) {
                        this.preferences.vflip = false;
                        this.preferences.hflip = false;
                    } else if (this.preferences.hflip === true) {
                        this.preferences.vflip = true;
                        this.preferences.hflip = false;
                    } else if (this.preferences.vflip === true) {
                        this.preferences.hflip = true;
                    }
                    this.savePreferences();
                    this.renderPage();
                    break;
                case KEYS.D:
                    if (hasModifier) break;
                    this.preferences.direction++;
                    if (this.preferences.direction > 1) this.preferences.direction = 0;
                    this.savePreferences();
                    break;
                case KEYS.NUM1:
                    if (hasModifier) break;
                    this.preferences.pageMode = 1;
                    this.savePreferences();
                    this.renderPage();
                    break;
                case KEYS.NUM2:
                    if (hasModifier) break;
                    this.preferences.pageMode = 2;
                    this.savePreferences();
                    this.renderPage();
                    break;
                default:
                    //console.log('KeyCode', evt.keyCode);
                    break;
            }
        },
        setTheme: function () {
            $("body").removeClass("light-theme").removeClass("dark-theme").addClass(`${this.preferences.theme}-theme`);
        },
        loadBookInfo: function () {

            return new Promise((resolve, reject) => {
                // get book info and metadata
                fetch(this.options.bookInfoUrl)
                    .then((response) => response.json())
                    .then((result) => {
                        console.log('Success:', result);
                        this.bookmarkUrl = result.bookmark_url;
                        this.fetchPagesUrl = result.page_url;
                        this.bookInfo = {
                            id: result.id,
                            title: result.title,
                            page_count: result.page_count,
                            format: result.format,
                            uncompressed_size: result.uncompressed_size,
                            publishers: result.publisher_list,
                            has_cover: result.has_cover,
                            description: result.description,
                            authors: result.author_list
                        };

                        console.log(this.bookInfo);
                        resolve();
                    })
                    .catch((error) => {
                        console.error('Error:', error);
                        reject;
                    });
            });
        },
        loadBook: async function () {
            // set title
            this.$elem.find(".book-title").text(this.bookInfo.title);

            // load some pages
            await this.loadPageRange();

            // display the current page
            this.renderPage();

        },
        bookmarkPage: function () {
            if (this.useBookmarks) {
                //This sends a bookmark update to calibreweb.
                $.ajax(this.bookmarkUrl, {
                    method: "post",
                    data: {
                        csrf_token: this.csrfToken,
                        bookmark: this.currentPage
                    }
                }).fail(function (xhr, status, error) {
                    console.error(error);
                });
            }
        },
        updateProgress: function () {
            var activepages = [];
            var currentPageText = "";
            if (this.preferences.pageMode == 1) {
                currentPageText = this.currentPage + 1;
                activepages.push(this.currentPage);
            } else if (this.preferences.pageMode == 2) {
                if (this.pageInfo[this.currentPage]?.isDoublePage(this.preferences.forceRotationDetection ? this.preferences.rotateTimes : 0) ||
                    this.pageInfo[this.currentPage + 1]?.isDoublePage(this.preferences.forceRotationDetection ? this.preferences.rotateTimes : 0)) {
                    currentPageText = this.currentPage + 1;
                    activepages.push(this.currentPage);
                } else {
                    currentPageText = `${this.currentPage + 1}-${this.currentPage + 2}`;
                    activepages.push(this.currentPage);
                    activepages.push(this.currentPage + 1);
                }
            }
            var progressText = `${currentPageText}/${this.bookInfo.page_count}`;
            this.$elem.find(".page-progress").text(progressText);
            this.$elem.find(".page-progress").stop(true).animate({ opacity: 1 }, 250).delay(5000).animate({ opacity: 0 }, 2000);
            this.$elem.find(".line-progress").css('width', `${(this.currentPage + 1) / this.bookInfo.page_count * 100}%`);

            var pages = this.$elem.find(".pages-list a.active");
            pages.removeClass("active");
            var self = this.$elem;
            activepages.forEach(id => {
                self.find(`.pages-list a[data-page-nb='${id}']`).addClass("active");
            });

            this.$elem.find(".sidebar").scrollTop(0);
            this.$elem.find(".sidebar").scrollTop(this.$elem.find(".sidebar .pages-list a.active").position()?.top);
        },
        getColorKey: function (self, canvas, left = true) {
            if (self.preferences.autoBackground) {
                var blockSize = 1, // only visit every 5 pixels
                    defaultRGB = { r: 255, g: 255, b: 255 }, // for non-supporting envs
                    i = -4,
                    length,
                    rgb = { r: 0, g: 0, b: 0 },
                    count = 0;

                var context = canvas.getContext("2d");
                var borderColor = defaultRGB;

                var countWhite = 0;
                var countBlack = 0;
                try {
                    var pixeldata = left ? context.getImageData(0, 0, 5, canvas.height) : context.getImageData(canvas.width - 5, 0, 5, canvas.height);
                    length = pixeldata.data.length;
                    while ((i += blockSize * 4) < length) {
                        ++count;
                        if (pixeldata.data[i] < 20 && pixeldata.data[i + 1] < 20 && pixeldata.data[i + 2] < 20)
                            countBlack++;

                        if (pixeldata.data[i] > 235 && pixeldata.data[i + 1] > 235 && pixeldata.data[i + 2] > 235)
                            countWhite++;

                        rgb.r += pixeldata.data[i];
                        rgb.g += pixeldata.data[i + 1];
                        rgb.b += pixeldata.data[i + 2];
                    }

                    // ~~ used to floor values
                    rgb.r = ~~(rgb.r / count);
                    rgb.g = ~~(rgb.g / count);
                    rgb.b = ~~(rgb.b / count);

                    if (countBlack > countWhite && countBlack > count / 3) {
                        borderColor = { r: 0, g: 0, b: 0 };
                    }
                    else if (countWhite > countBlack && countWhite > count / 3) {
                        borderColor = { r: 255, g: 255, b: 255 };
                    }
                    else {
                        borderColor = rgb;
                    }

                    return borderColor;

                } catch (e) {
                    console.error(e);
                    /* security error, img on diff domain *///alert('x');
                    // return defaultRGB;
                }
            }
            return undefined;

        },
        renderPage: function () {

            if (this.preferences.nextPage === 0) {
                $(document).scrollTop(0);
                $(".render-view").scrollTop(0);
            } else {
                this.lastScrollPosition = $(document).scrollTop();
            }
            this.$elem.find(".page-view").css("background", "none");
            // render the page/pages based on the render mode
            if (this.preferences.pageMode == 1) {
                this.$elem.find(".sidebar .pages-list").removeClass("double-view");
                this.renderSinglePage();
            }
            else if (this.preferences.pageMode == 2) {
                this.$elem.find(".sidebar .pages-list").addClass("double-view");
                if (this.pageInfo[this.currentPage].isDoublePage(this.preferences.forceRotationDetection ? this.preferences.rotateTimes : 0) ||
                    this.pageInfo[this.currentPage + 1].isDoublePage(this.preferences.forceRotationDetection ? this.preferences.rotateTimes : 0)) {
                    this.renderSinglePage();
                }
                else {
                    this.renderDoublePage();
                }
            }

            this.bookmarkPage();

        },
        renderSinglePage: function () {
            let preferences = this.preferences;
            let pageInfo = this.pageInfo[this.currentPage];
            let renderView = this.$elem.find(".render-view");
            let lastScrollPosition = this.preferences.nextPage !== 0 ? this.lastScrollPosition : undefined;
            let self = this;
            return new Promise(async (resolve, reject) => {

                var canvas = await this.renderPageCanvas(this.currentPage);

                renderView.html("");
                renderView.append(canvas);

                if (this.preferences.theme != "dark") {
                    var rgb = self.getColorKey(self, canvas, true);
                    if (rgb !== undefined) {
                        self.$elem.find(".page-view").css("background", "rgb(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ")");
                    }
                }

                if (lastScrollPosition !== undefined) {
                    $(document).scrollTop(lastScrollPosition);
                }
                self.applyRenderScale();
                resolve();
            });
        },
        renderDoublePage: function () {

            var canvas = document.createElement('canvas');
            var context = canvas.getContext("2d");

            let preferences = this.preferences;
            let pageInfo = this.pageInfo[this.currentPage];
            let renderView = this.$elem.find(".render-view");
            let lastScrollPosition = this.preferences.nextPage !== 0 ? this.lastScrollPosition : undefined;
            let self = this;
            return new Promise(async (resolve, reject) => {

                var canvas1 = await this.renderPageCanvas(this.currentPage);
                var canvas2 = await this.renderPageCanvas(this.currentPage + 1);
                context.save();

                var h = Math.max(canvas1.height, canvas2.height),
                    w = canvas1.width + canvas2.width;
                if (preferences.rotateTimes % 2 === 1) {
                    h = canvas1.height + canvas2.height;
                    w = Math.max(canvas1.width, canvas2.width);
                }

                canvas.height = h;
                canvas.width = w;

                if (preferences.rotateTimes === 0) {
                    context.drawImage(canvas1, 0, 0);
                    context.drawImage(canvas2, canvas1.width, 0);
                    if (self.preferences.pageShadow) {
                        const shadowSize = 0.06;
                        // Create gradient
                        var gradient = context.createLinearGradient(canvas1.width - (canvas1.width * shadowSize), 0, canvas1.width + (canvas2.width * shadowSize), 0);
                        gradient.addColorStop(0, "#00000000");
                        gradient.addColorStop(.38, "#00000044");
                        gradient.addColorStop(.47, "#00000066");
                        gradient.addColorStop(.5, "#00000088");
                        gradient.addColorStop(.53, "#00000066");
                        gradient.addColorStop(.62, "#00000044");
                        gradient.addColorStop(1, "#00000000");

                        // Fill with gradient
                        context.fillStyle = gradient;
                        context.fillRect(canvas1.width - (canvas1.width * shadowSize), 0, (canvas1.width * shadowSize) + (canvas2.width * shadowSize), h);
                    }
                }
                else if (preferences.rotateTimes === 1) {
                    context.drawImage(canvas1, 0, 0);
                    context.drawImage(canvas2, 0, canvas1.height);
                }
                else if (preferences.rotateTimes === 2) {
                    context.drawImage(canvas2, 0, 0);
                    context.drawImage(canvas1, canvas2.width, 0);
                }
                else if (preferences.rotateTimes === 3) {
                    context.drawImage(canvas2, 0, 0);
                    context.drawImage(canvas1, 0, canvas2.height);
                }
                if (this.preferences.theme != "dark") {
                    var rgb1 = self.getColorKey(self, canvas, true);
                    var rgb2 = self.getColorKey(self, canvas, false);
                    if (rgb1 !== undefined && rgb2 !== undefined) {
                        // self.$elem.find(".page-view").css("background", "rgb(" + rgb1.r + ", " + rgb1.g + ", " + rgb1.b + ")");
                        var linear = `linear-gradient(90deg, rgb(${rgb1.r}, ${rgb1.g}, ${rgb1.b}) 50%, rgb(${rgb2.r}, ${rgb2.g}, ${rgb2.b})  50%)`;
                        self.$elem.find(".page-view").css("background", linear);
                    }
                    else if (rgb1 !== undefined) {
                        self.$elem.find(".page-view").css("background", "rgb(" + rgb1.r + ", " + rgb1.g + ", " + rgb1.b + ")");
                    }
                    else if (rgb2 !== undefined) {
                        self.$elem.find(".page-view").css("background", "rgb(" + rgb2.r + ", " + rgb2.g + ", " + rgb2.b + ")");
                    }
                }

                renderView.html("");
                renderView.append(canvas);

                if (lastScrollPosition !== undefined) {
                    $(document).scrollTop(lastScrollPosition);
                }
                self.applyRenderScale();
                resolve();
            });
        },
        renderPageCanvas: function (pageIndex) {
            var canvas = document.createElement('canvas');
            var context = canvas.getContext("2d");
            let preferences = this.preferences;
            let pageInfo = this.pageInfo[pageIndex];
            let renderView = this.$elem.find(".render-view");
            let lastScrollPosition = this.preferences.nextPage !== 0 ? this.lastScrollPosition : undefined;
            let self = this;
            return new Promise((resolve, reject) => {

                var img = new Image();
                // img.onerror = function (){

                // };
                img.onload = function () {

                    var h = img.height,
                        w = img.width,
                        sw = w,
                        sh = h;

                    // handle rotation
                    context.save();
                    if (preferences.rotateTimes % 2 === 1) {
                        sh = w;
                        sw = h;
                    }
                    canvas.height = sh;
                    canvas.width = sw;
                    context.translate(sw / 2, sh / 2);
                    context.rotate(Math.PI / 2 * preferences.rotateTimes);
                    context.translate(-w / 2, -h / 2);

                    // handle flips
                    if (preferences.vflip) {
                        context.scale(1, -1);
                        context.translate(0, -h);
                    }
                    if (preferences.hflip) {
                        context.scale(-1, 1);
                        context.translate(-w, 0);
                    }

                    // canvas.style.display = "none";
                    // scrollTo(0, 0);
                    context.drawImage(img, 0, 0);
                    context.restore();
                    resolve(canvas);

                }

                img.src = this.pageInfo[pageIndex].blobUrl;

            });
        },


        applyRenderScale: function () {
            var $canvas = this.$elem.find(".render-view canvas");
            $canvas.removeClass("fit-best");
            $canvas.removeClass("fit-width");
            $canvas.removeClass("fit-height");
            $canvas.removeClass("fit-natural");
            switch (this.preferences.fitMode) {
                case KEYS.B: // Best Mode
                    $canvas.addClass("fit-best");
                    break;
                case KEYS.W:
                    $canvas.addClass("fit-width");
                    break;
                case KEYS.H:
                    $canvas.addClass("fit-height");
                    break;
                case KEYS.N:
                    $canvas.addClass("fit-natural");
                    break;
                default:
                    break;
            }
        },
        loadPageRange: async function () {
            if (this.pageInfo[this.currentPage] === undefined) {
                await this.loadPage(this.currentPage);
            }
            var pageOffset = this.preferences.pageMode == 2 ? 1 : 0;
            for (let i = 1; i <= this.preferences.preloadPageNb + pageOffset; i++) {
                if (this.currentPage + i <= Math.max(this.bookInfo.page_count, this.pageInfo.length) && this.pageInfo[this.currentPage + i] === undefined) {
                    await this.loadPage(this.currentPage + i);
                }
            }
            for (let i = 1; i <= this.preferences.preloadPageNb; i++) {
                if (this.currentPage - i >= 0 && this.pageInfo[this.currentPage - i] === undefined) {
                    await this.loadPage(this.currentPage - i);
                }
            }
        },
        loadPage: async function (index) {
            let filename = this.fetchPagesUrl + index;
            var response = await fetch(filename);
            if (response.ok) {
                var ar = await response.arrayBuffer();
                var mimetype = response.headers.get("content-type");

                this.pageInfo[index] = {
                    id: index + 1,
                    url: filename,
                    filetype: mimetype,
                    blobUrl: this.createBlob(ar, mimetype),
                    height: 0,
                    width: 0,
                    isDoublePage: false
                }

                await this.getImageInfo(this.pageInfo[index]);

                this.updatePagesList();


            } else {
                console.warn(request.statusText, request.responseText);
            }
        },
        getImageInfo: function (pageInfo) {
            return new Promise((resolve, reject) => {

                let rotateTimes = this.preferences.rotateTimes;
                var img = new Image();
                img.onerror = () => reject;

                img.onload = function () {
                    pageInfo.height = img.height;
                    pageInfo.width = img.width;
                    pageInfo.isDoublePage = (rotateTimes) => {

                        if (rotateTimes == 0 || rotateTimes == 2) {
                            if (pageInfo.width > pageInfo.height) {
                                return true;
                            }
                        } else if (rotateTimes == 1 || rotateTimes == 3) {
                            if (pageInfo.height > pageInfo.width) {
                                return true;
                            }
                        }
                        return false;
                    }
                    resolve();
                };

                img.src = pageInfo.blobUrl;

            });
        },
        createBlob: function (arrayBuffer, mimeType) {
            var offset = 0; // arrayBuffer.byteOffset;
            var len = arrayBuffer.byteLength;
            var blob;

            if (mimeType === "image/xml+svg") {
                var xmlStr = new TextDecoder("utf-8").decode(arrayBuffer);
                return "data:image/svg+xml;UTF-8," + encodeURIComponent(xmlStr);
            }

            // Blob constructor, see http://dev.w3.org/2006/webapi/FileAPI/#dfn-Blob.
            if (typeof Blob === "function") {
                blob = new Blob([arrayBuffer], { type: mimeType });
            } else {
                throw "Browser support for Blobs is missing.";
            }

            if (blob.slice) {
                blob = blob.slice(offset, offset + len, mimeType);
            } else {
                throw "Browser support for Blobs is missing.";
            }

            if ((typeof URL !== "function" && typeof URL !== "object") ||
                typeof URL.createObjectURL !== "function") {
                throw "Browser support for Object URLs is missing";
            }

            return URL.createObjectURL(blob);
        },
        updatePagesList: function () {

            var pageList = $(document.createElement("div"));

            var sideClass = "page-left";
            for (let i = 0; i < this.pageInfo.length; i++) {
                if (this.pageInfo[i]) {
                    var dblClass = "is-single-page";
                    if (this.pageInfo[i] && this.pageInfo[i].isDoublePage(this.preferences.forceRotationDetection ? this.preferences.rotateTimes : 0) ||
                        this.pageInfo[i + 1] && this.pageInfo[i + 1].isDoublePage(this.preferences.forceRotationDetection ? this.preferences.rotateTimes : 0)) {
                        dblClass = "is-double-page";
                        sideClass = "page-left";
                    }
                    var activeClass = i == this.currentPage ? "active" : "";
                    if (this.preferences.pageMode == 2 && dblClass == "is-single-page" && sideClass == "page-right" && activeClass == "") {
                        activeClass = i == this.currentPage + 1 ? "active" : "";
                    }

                    pageList.append(
                        `<section class="page-thumbnail ${dblClass} ${sideClass}">` +
                        `<a data-page-nb="${i}" class="${activeClass}">` +
                        `<img src="${this.pageInfo[i].blobUrl}" alt="page ${this.pageInfo[i].id}" />` +
                        `<div class="page-nb"><span>${this.pageInfo[i].id}</span></div>` +
                        '</section>'
                    );
                    if (dblClass != "is-double-page") {
                        sideClass = sideClass == "page-left" ? "page-right" : "page-left";
                    }
                }
            }

            var pageListHtml = this.$elem.find(".pages-list");
            pageListHtml.html(pageList.html());

            pageListHtml.find("a").click((event) => {
                var pageNb = $(event.currentTarget).data("page-nb");
                this.currentPage = pageNb;
                this.renderPage();
            })

            this.$elem.find(".sidebar").scrollTop(0);
            this.$elem.find(".sidebar").scrollTop(this.$elem.find(".sidebar .pages-list a.active").position()?.top);
        },
        savePreferences: function () {
            localStorage.comicsReaderPreferences = JSON.stringify(this.preferences);
            this.applyPreferencesDom();
        },
        loadPreferences: function () {
            try {
                if (!localStorage.comicsReaderPreferences) {
                    return;
                }

                $.extend(this.preferences, JSON.parse(localStorage.comicsReaderPreferences));

            } catch (err) {
                console.log(`Error loading preferences ${err}`);
                alert("Error loading preferences");
            }
        },
        applyPreferencesDom: function () {
            // Set preferences control values
            let $elem = this.$elem;
            $.each(this.preferences, function (key, value) {
                if (typeof value === "boolean") {
                    $elem.find(".preferences-modal input[name=" + key + "]").prop("checked", value);
                } else {
                    $elem.find(".preferences-modal input[name=" + key + "]").val([value]);
                }
            });
        },
        readPreferencesDom: function (self, event) {
            var elem = event.currentTarget;
            // Get either the checked boolean or the assigned value
            var value = elem.type === "checkbox" ? elem.checked : elem.value;
            // If it's purely numeric, parse it to an integer
            value = /^\d+$/.test(value) ? parseInt(value) : value;
            self.preferences[elem.name] = value;


            self.savePreferences();
            if (elem.name == "theme") {
                self.setTheme();
            }
            self.applyScrollbarSettings();
            self.applyRenderScale();
            self.renderPage();
        },
        applyScrollbarSettings: function () {
            if (this.preferences.scrollbar === 0) {
                $("body").addClass("disabled-scrollbar");
                $("render-view").addClass("disabled-scrollbar");
            }
            else {
                $("body").removeClass("disabled-scrollbar");
                $("render-view").removeClass("disabled-scrollbar");

            }
        },
        leftClicked: function () {
            if (this.preferences.direction === 0) {
                this.gotoPrevPage();
            } else {
                this.gotoNextPage();
            }
        },
        rightClicked: function () {
            if (this.preferences.direction === 0) {
                this.gotoNextPage();
            } else {
                this.gotoPrevPage();
            }
        },
        gotoPrevPage: function () {
            if (this.preferences.pageMode == 1) {
                this.currentPage--;
            }
            else if (this.preferences.pageMode == 2) {
                if (this.pageInfo[this.currentPage - 1].isDoublePage(this.preferences.forceRotationDetection ? this.preferences.rotateTimes : 0) ||
                    this.pageInfo[this.currentPage - 2].isDoublePage(this.preferences.forceRotationDetection ? this.preferences.rotateTimes : 0)) {
                    this.currentPage--;
                }
                else {
                    this.currentPage -= 2;

                }
            }

            if (this.currentPage < 0) {
                this.currentPage = 0;
            }

            this.loadPageRange();
            this.renderPage();
        },
        gotoNextPage: function () {
            if (this.preferences.pageMode == 1) {
                this.currentPage++;
            }
            else if (this.preferences.pageMode == 2) {
                if (this.pageInfo[this.currentPage + 1].isDoublePage(this.preferences.forceRotationDetection ? this.preferences.rotateTimes : 0) ||
                    this.pageInfo[this.currentPage + 2].isDoublePage(this.preferences.forceRotationDetection ? this.preferences.rotateTimes : 0)) {
                    this.currentPage++;
                }
                else {
                    this.currentPage += 2;

                }
            }

            if (this.currentPage >= Math.max(this.bookInfo.page_count, this.pageInfo.length)) {
                this.currentPage = Math.max(this.bookInfo.page_count, this.pageInfo.length) - 1;
            }

            this.loadPageRange();
            this.renderPage();
        },
        // Preference Modal
        preferencesDom: function () {

            if ($("template#preferences-modal").length == 1) {
                var modal = $("template#preferences-modal").html();
                modal = $(modal);
                modal[0] = $(modal[0]).addClass("preferences-modal")[0];
                $(modal[0]).find("input").change((event) => this.readPreferencesDom(this, event));

                return modal;
            }

            return undefined;
        },
        screenfull: function () {
            // Fullscreen mode
            if (typeof screenfull !== "undefined") {
                let self = this;
                this.$elem.find(".fullscreen-button").click(() => {
                    screenfull.toggle(self.$elem.find(".main-view")[0]);
                });
                if (screenfull.raw) {
                    document.addEventListener(screenfull.raw.fullscreenchange, function () {
                        screenfull.isFullscreen
                            ? self.$elem.find(".main-view").removeClass("sidebar-opened").addClass("fullscreen")
                            : self.$elem.find(".main-view").removeClass("fullscreen");
                    });
                }
            }
        },
        reset: function () {
            this.$modalTitle.text(this.options.modalTitle);
            this.$modalFooter.hide();
            this.$modalBar.addClass("progress-bar-success");
            this.$modalBar.removeClass("progress-bar-danger");
            if (this.xhr) {
                this.xhr.abort();
            }
        }
    };


    $.fn.comicsreader = function (options) {
        return this.each(function () {
            var _options = $.extend({}, $.fn.comicsreader.defaults, options);
            var comicsReader = new ComicsReader(this, _options);
            comicsReader.constructor();
        });
    };

    $.fn.comicsreader.defaults = {
        bookInfoUrl: "",
        bookmark: 0,
        useBookmarks: false,
        csrfToken: "",

        hflip: false,
        vflip: false,
        rotateTimes: 0,
        fitMode: KEYS.B,
        theme: "light",
        direction: 0, // 0 = Left to Right, 1 = Right to Left
        nextPage: 0, // 0 = Reset to Top, 1 = Remember Position
        scrollbar: 1, // 0 = Hide Scrollbar, 1 = Show Scrollbar
        pageMode: 1
    };


})(window.jQuery);
