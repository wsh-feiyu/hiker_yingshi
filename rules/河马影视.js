/**
 * 河马视频 - 海阔视界规则（含本地代理播放）
 * @namespace csdown
 * @description 河马视频源，支持 M3U8 本地代理播放
 * 
 * @property {Array} d - 页面数据数组
 * @property {Array} d_ - 预加载数据数组
 * @property {string} author - 规则作者
 * @property {string} title - 规则标题
 * @property {number} version - 版本号
 */
const csdown = {
    d: [],
    d_: [],
    author: 'feiyu',
    title: '河马视频',
    version: 20260127,
    
    // 配置项
    host: 'https://dy.jmzp.net.cn',
    app_id: 'shiguang',
    versionCode: '10000',
    channel: 'guan',
    play_domain: '',
    encrypt_domain: 'vT1RQRz8YzlzTgN26pIXNJ7Mi65juwSP',
    key: 'ZT8g6QH2kS3Xj7G5wG4JtU1F',
    iv: '51518888',
    
    headers: {
        'User-Agent': 'Android',
        'Connection': 'Keep-Alive',
        'Accept': 'application/vnd.yourapi.v1.full+json',
        'Device-Id': '',
        'Screen-Width': '2670',
        'Channel': 'guan',
        'Cur-Time': '',
        'Mob-Mfr': 'xiaomi',
        'prefersex': '1',
        'Mob-Model': 'xiaomi',
        'token': '',
        'Sys-Release': '15',
        'appid': '',
        'Version-Code': '',
        'Sys-Platform': 'Android',
        'Screen-Height': '1200',
        'timestamp': ''
    },
    play_headers: {'User-Agent': 'Mozi'},
    
    /**
     * 辅助样式方法
     */
    color: function(txt) {
        return '<b><font color=#FF6699>' + txt + '</font></b>';
    },
    strong: function(d, c) {
        return '‘‘’’<strong><font color=#' + (c || '000000') + '>' + d + '</font></strong>';
    },
    
    /**
     * 生成设备ID
     */
    generateDeviceId: function() {
        var chars = '0123456789abcdef';
        var res = '';
        for (var i = 0; i < 16; i++) {
            res += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return res;
    },
    
    /**
     * 获取时间戳
     */
    getTimestamp: function() {
        return String(new Date().getTime());
    },
    
    /**
     * 获取16进制时间戳（用于签名）
     */
    getHexTime: function() {
        return Math.floor(new Date().getTime() / 1000).toString(16);
    },
    
    /**
     * HLS链接签名
     */
    hlsSign: function(url) {
        var signUrl = url.split('?')[0];
        var hexTime = this.getHexTime();
        var data = signUrl.replace(this.play_domain, this.encrypt_domain) + hexTime;
        var wsSecret = '';
        try {
            eval(getCryptoJS());
            wsSecret = CryptoJS.MD5(data).toString();
        } catch(e) {}
        return '&wsSecret=' + wsSecret + '&wsTime=' + hexTime;
    },
    
    /**
     * DES3解密
     */
    decryptData: function(ciphertext) {
        if (!ciphertext) return null;
        var cleanCipher = ciphertext.replace(/[\r\n\s]/g, '');
        try {
            eval(getCryptoJS());
            var key = CryptoJS.enc.Utf8.parse(this.key);
            var iv = CryptoJS.enc.Utf8.parse(this.iv);
            var decrypted = CryptoJS.TripleDES.decrypt(cleanCipher, key, {
                iv: iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
            });
            return decrypted.toString(CryptoJS.enc.Utf8);
        } catch(e) {
            return null;
        }
    },
    
    /**
     * 网络请求
     */
    request: function(url, data) {
        this.headers.timestamp = this.getTimestamp();
        var formBody = [];
        for (var key in data) {
            formBody.push(key + '=' + encodeURIComponent(data[key]));
        }
        var body = formBody.join('&');
        
        try {
            var html = fetch(url, {
                headers: this.headers,
                method: 'POST',
                body: body
            });
            var json = JSON.parse(html);
            if (json.data) {
                var decrypted = this.decryptData(json.data);
                if (decrypted) {
                    return JSON.parse(decrypted);
                }
            }
            return json;
        } catch(e) {
            log('request error: ' + e.message);
            return {};
        }
    },
    
    /**
     * 初始化配置
     */
    init: function() {
        if (!getItem('hmys_deviceid')) {
            setItem('hmys_deviceid', this.generateDeviceId());
        }
        this.headers['Device-Id'] = getItem('hmys_deviceid');
        if (!getItem('hmys_host')) {
            setItem('hmys_host', this.host);
        }
        if (!getItem('hmys_appid')) {
            setItem('hmys_appid', this.app_id);
        }
        if (!getItem('hmys_version')) {
            setItem('hmys_version', this.versionCode);
        }
        if (!getItem('hmys_channel')) {
            setItem('hmys_channel', this.channel);
        }
        this.host = getItem('hmys_host');
        this.headers.appid = getItem('hmys_appid');
        this.headers['Version-Code'] = getItem('hmys_version');
        this.headers.Channel = getItem('hmys_channel');
    },
    
    /**
     * 登录获取token和play_domain
     */
    login: function() {
        if (this.headers.token && this.play_domain) return;
        this.headers['Cur-Time'] = this.headers.timestamp = this.getTimestamp();
        try {
            var resp = this.request(this.host + '/api/user/init', {'password': '', 'account': ''});
            if (resp && resp.result) {
                this.headers.token = resp.result.user_info.token;
                this.play_domain = resp.result.sys_conf.play_domain;
                this.host = resp.result.sys_conf.host_main || this.host;
                setItem('hmys_host', this.host);
                if (resp.result.sys_conf.encrypt_domain) {
                    this.encrypt_domain = resp.result.sys_conf.encrypt_domain;
                }
                this.request(this.host + '/api/stats/login', {'action': '6'});
            }
        } catch(e) {
            log('login error: ' + e.message);
        }
    },
    
    /**
     * 解析视频简要信息
     */
    parseVodShort: function(v) {
        var remark = v.type_pid != 1 ? (v.is_end == 1 ? v.serial + '集全' : '更新至' + v.serial + '集') : '评分：' + v.score;
        return {
            title: v.title,
            img: v.pic,
            desc: remark,
            url: $('hiker://empty?#immersiveTheme#').rule(() => {
                $.require("csdown").detail();
            }),
            col_type: 'movie_3',
            extra: {
                vod_id: v.vod_id.toString(),
                vod_name: v.title
            }
        };
    },
    
    /**
     * 主页入口
     */
    home: function() {
        var d = this.d;
        var d_ = this.d_;
        var pg = MY_PAGE;
        
        if (MY_PAGE == 1) {
            this.init();
            this.login();
            
            d_.push({
                col_type: 'blank_block',
                extra: {id: 'blank_1'}
            }, {
                img: "http://123.56.105.145/weisyr/img/Loading1.gif",
                url: "hiker://empty",
                col_type: "pic_1_full",
                extra: {id: "loading_"}
            });
            setPreResult(d_);
            
            d.push({
                title: "搜索 ",
                url: $.toString(() => {
                    if (input) {
                        putMyVar('hmys_keyword', input);
                        return $('hiker://empty?page=fypage').rule(() => {
                            $.require("csdown").search();
                        });
                    }
                    return "hiker://empty";
                }),
                desc: "请输入搜索关键词",
                col_type: "input",
                extra: {
                    defaultValue: getMyVar('hmys_keyword', '')
                }
            });
            d.push({col_type: 'blank_block'});
            
            var cateData = this.request(this.host + '/api/block/category_type', {});
            var classes = [];
            if (cateData && cateData.result) {
                for (var i = 0; i < cateData.result.length; i++) {
                    classes.push({
                        title: cateData.result[i].type_name,
                        id: cateData.result[i].type_pid.toString()
                    });
                }
                putMyVar('hmys_classes', JSON.stringify(classes));
            }
            
            if (classes.length > 0) {
                var currentCate = getMyVar('hmys_cate_id', classes[0].id);
                for (var i = 0; i < classes.length; i++) {
                    d.push({
                        title: currentCate == classes[i].id ? this.strong(classes[i].title, 'ff6699') : classes[i].title,
                        url: $('#noLoading#').lazyRule((id) => {
                            putMyVar('hmys_cate_id', id);
                            refreshPage(false);
                            return 'hiker://empty';
                        }, classes[i].id),
                        col_type: 'scroll_button',
                        extra: {
                            backgroundColor: currentCate == classes[i].id ? "#20FA7298" : "",
                        }
                    });
                }
                d.push({col_type: 'blank_block'});
            }
            
            var navData = this.request(this.host + '/api/nav/list', {});
            var rec = null;
            if (navData && navData.result) {
                for (var i = 0; i < navData.result.length; i++) {
                    if (navData.result[i].nav_name === '推荐') {
                        rec = navData.result[i];
                        break;
                    }
                }
            }
            
            var indexData = this.request(this.host + '/api/nav/index', {nav_id: rec ? rec.nav_id : '253'});
            if (indexData && indexData.result) {
                for (var i = 0; i < indexData.result.length; i++) {
                    var item = indexData.result[i];
                    if (item.block_list) {
                        for (var j = 0; j < item.block_list.length; j++) {
                            var block = item.block_list[j];
                            if (block.vod_list && block.vod_list.length > 0) {
                                d.push({
                                    title: this.color(block.title || '精选推荐'),
                                    img: 'hiker://images/icon_right5',
                                    url: $('hiker://empty?page=fypage').rule(() => {
                                        $.require("csdown").category();
                                    }),
                                    col_type: 'text_icon',
                                    extra: {lineVisible: false}
                                });
                                for (var k = 0; k < block.vod_list.length; k++) {
                                    d.push(this.parseVodShort(block.vod_list[k]));
                                }
                            }
                        }
                    }
                }
            }
        }
        
        deleteItem("loading_");
        setResult(d);
    },
    
    /**
     * 分类页面
     */
    category: function() {
        var d = this.d;
        var d_ = this.d_;
        var pg = MY_PAGE;
        var tid = getMyVar('hmys_cate_id', '1');
        
        if (pg == 1) {
            d_.push({
                img: "http://123.56.105.145/weisyr/img/Loading1.gif",
                url: "hiker://empty",
                col_type: "pic_1_full",
                extra: {id: "loading_"}
            });
            setPreResult(d_);
            
            var cateData = this.request(this.host + '/api/block/category_type', {});
            if (cateData && cateData.result) {
                for (var i = 0; i < cateData.result.length; i++) {
                    var item = cateData.result[i];
                    if (item.type_pid == tid) {
                        var parseAttr = function(str) {
                            if (!str) return [];
                            var arr = str.split(',');
                            var res = [];
                            for (var j = 0; j < arr.length; j++) {
                                res.push({n: arr[j].trim(), v: arr[j].trim()});
                            }
                            return res;
                        };
                        
                        var filters = [
                            {key: 'class', name: '类型', values: parseAttr(item.cate), def: '全部'},
                            {key: 'area', name: '地区', values: parseAttr(item.area), def: '全部'},
                            {key: 'year', name: '年份', values: parseAttr(item.year), def: '全部'},
                            {key: 'sort', name: '排序', values: parseAttr(item.order), def: '最热'}
                        ];
                        
                        for (var f = 0; f < filters.length; f++) {
                            var filter = filters[f];
                            if (filter.values.length > 0) {
                                var current = getMyVar('hmys_filter_' + filter.key, filter.def);
                                for (var v = 0; v < filter.values.length; v++) {
                                    d.push({
                                        title: current == filter.values[v].v ? this.strong(filter.values[v].n, 'ff6699') : filter.values[v].n,
                                        url: $('#noLoading#').lazyRule((key, val) => {
                                            putMyVar('hmys_filter_' + key, val);
                                            refreshPage(false);
                                            return 'hiker://empty';
                                        }, filter.key, filter.values[v].v),
                                        col_type: 'scroll_button',
                                        extra: {
                                            backgroundColor: current == filter.values[v].v ? "#20FA7298" : "",
                                        }
                                    });
                                }
                            }
                        }
                        d.push({col_type: 'blank_block'});
                        break;
                    }
                }
            }
        }
        
        var payload = {
            area: getMyVar('hmys_filter_area', '全部'),
            cate: getMyVar('hmys_filter_class', '全部'),
            type_pid: tid,
            year: getMyVar('hmys_filter_year', '全部'),
            length: '12',
            page: pg.toString(),
            order: getMyVar('hmys_filter_sort', '最热')
        };
        
        var data = this.request(this.host + '/api/block/category', payload);
        if (data && data.result) {
            for (var i = 0; i < data.result.length; i++) {
                d.push(this.parseVodShort(data.result[i]));
            }
        }
        
        deleteItem("loading_");
        setResult(d);
    },
    
    /**
     * 搜索功能
     */
    search: function() {
        var d = this.d;
        var d_ = this.d_;
        var pg = MY_PAGE;
        var keyword = getMyVar('hmys_keyword');
        
        if (!keyword) {
            setResult(d);
            return;
        }
        
        if (pg == 1) {
            d_.push({
                img: "http://123.56.105.145/weisyr/img/Loading1.gif",
                url: "hiker://empty",
                col_type: "pic_1_full",
                extra: {id: "loading_"}
            });
            setPreResult(d_);
        }
        
        var data = this.request(this.host + '/api/search/result', {
            type_pid: "0",
            kw: keyword,
            pn: pg.toString()
        });
        
        if (data && data.result) {
            for (var i = 0; i < data.result.length; i++) {
                var item = data.result[i];
                var remark = item.type_pid != '1' ? (item.serial + '集') : item.tags;
                if (item.short_video == 1) remark += ',短剧';
                
                d.push({
                    title: item.title,
                    img: item.pic,
                    desc: remark + ' ' + item.year,
                    url: $('hiker://empty?#immersiveTheme#').rule(() => {
                        $.require("csdown").detail();
                    }),
                    col_type: 'movie_3',
                    extra: {
                        vod_id: item.vod_id.toString(),
                        vod_name: item.title
                    }
                });
            }
        }
        
        deleteItem("loading_");
        setResult(d);
    },
    
    /**
     * 详情页
     */
    detail: function() {
        var d = this.d;
        var id = MY_PARAMS.vod_id;
        var name = MY_PARAMS.vod_name;
        
        setPageTitle(name);
        addListener('onClose', $.toString(() => {
            clearMyVar('hmys_sort');
        }));
        
        var data = this.request(this.host + '/api/vod/info', {vod_id: id});
        if (!data || !data.result) {
            setResult(d);
            return;
        }
        
        var res = data.result;
        
        d.push({
            title: res.title + '\n' + ('‘‘’’' + (res.tags || '') + ' ' + (res.year || '')).small(),
            desc: (res.actor ? '演员：' + res.actor + '\n' : '') + (res.remarks || ''),
            img: res.pic,
            url: res.pic + '#.jpg#',
            col_type: 'movie_1_vertical_pic_blur',
            extra: {vod_id: res.vod_id}
        });
        
        if (res.intro) {
            d.push({
                title: '<b><font color="#098AC1">∷剧情简介    </font></b><br><font color="grey">　　' + res.intro.replace(/\n/g, '<br>') + '</font>',
                col_type: 'rich_text',
                extra: {
                    lineSpacing: 6,
                    textSize: 15,
                    lineVisible: true,
                }
            });
        }
        
        if (res.map_list && res.map_list.length > 0) {
            d.push({
                col_type: 'blank_block',
                extra: {id: 'blank_before_list'}
            });
            
            d.push({
                title: (getMyVar('hmys_sort', '0') == '1') ? '““””<b><span style="color: #FF0000">逆序</span></b>' : '““””<b><span style="color: #1aad19">正序</span></b>',
                url: $('#noLoading#').lazyRule(() => {
                    var sort = getMyVar('hmys_sort', '0');
                    putMyVar('hmys_sort', sort == '1' ? '0' : '1');
                    refreshPage(false);
                    return 'hiker://empty';
                }),
                col_type: 'text_center_1',
                extra: {id: '排序', lineVisible: false}
            });
            
            var urls = res.map_list;
            if (getMyVar('hmys_sort', '0') == '1') {
                urls = urls.slice().reverse();
            }
            
            for (var i = 0; i < urls.length; i++) {
                d.push({
                    title: urls[i].title,
                    url: $().lazyRule((video_id, vod_map_id, collection) => {
                        return $.require("csdown").play(video_id, vod_map_id, collection);
                    }, id, urls[i].id, urls[i].collection),
                    col_type: 'text_2',
                    extra: {cls: '选集_'}
                });
            }
        }
        
        setResult(d);
    },
    
    /**
     * 播放解析 - 返回本地代理URL
     */
    play: function(video_id, vod_map_id, collection) {
        try {
            var data = this.request(this.host + '/api/vod/play_url', {
                xz: "0",
                vod_map_id: vod_map_id,
                vod_id: video_id,
                collection: collection
            });
            
            if (data && data.result) {
                var res = data.result;
                var ck = res.ck || '';
                
                // Base64解码ck
                try {
                    eval(getCryptoJS());
                    var parsed = CryptoJS.enc.Base64.parse(ck).toString(CryptoJS.enc.Utf8);
                    if (parsed) ck = parsed;
                } catch(e) {}
                
                var targetUrl;
                if (res.check_url) {
                    targetUrl = res.check_url;
                    // 直链MP4直接播放
                    if (targetUrl.indexOf('.mp4') > -1 && targetUrl.indexOf('.m3u8') === -1) {
                        return targetUrl;
                    }
                } else {
                    targetUrl = res.vod_url + (ck ? '?' + ck : '');
                }
                
                // 构造本地代理地址 http://127.0.0.1:9978/proxy?do=js...
                // url 参数需要双重编码
                var headerStr = encodeURIComponent(JSON.stringify(this.play_headers));
                var urlStr = encodeURIComponent(encodeURIComponent(targetUrl));
                
                var proxyUrl = "http://127.0.0.1:9978/proxy?do=js&from=catvod&siteType=3&siteKey=hmys&header=" + headerStr + "&url=" + urlStr;
                return proxyUrl;
            }
        } catch(e) {
            log('play error: ' + e.message);
        }
        return 'toast://获取播放链接失败';
    },
    
    /**
     * 代理函数 - 处理M3U8和TS分片
     * @param {Object} params - 包含 url、header 等参数的对象
     * @returns {string} - JSON字符串，包含code、content、headers
     */
    proxy: function(params) {
        var inputUrl = params.url || '';
        var headers = this.play_headers;
        
        // 解析header参数
        if (params.header) {
            try {
                headers = JSON.parse(decodeURIComponent(params.header));
            } catch(e) {}
        }
        
        // 解码URL（双重编码需要解码两次）
        var realUrl = inputUrl;
        try {
            realUrl = decodeURIComponent(inputUrl);
            // 如果是双重编码，再解码一次
            if (realUrl.indexOf('%3A') > -1 || realUrl.indexOf('%2F') > -1) {
                realUrl = decodeURIComponent(realUrl);
            }
        } catch(e) {
            realUrl = inputUrl;
        }
        
        // TS分片代理 - 302跳转
        if (realUrl.indexOf('ts@') > -1) {
            var tsUrl = realUrl.split('ts@')[1];
            try {
                tsUrl = decodeURIComponent(tsUrl);
            } catch(e) {}
            
            var sign = this.hlsSign(tsUrl);
            var finalUrl = tsUrl + sign;
            
            return JSON.stringify({
                code: 302,
                content: "",
                headers: {
                    "Location": finalUrl,
                    "User-Agent": headers['User-Agent'] || 'Mozi'
                }
            });
        } 
        // M3U8主文件代理
        else {
            try {
                var m3u8Content = fetch(realUrl, {headers: headers});
                
                if (!m3u8Content) {
                    return JSON.stringify({
                        code: 500, 
                        content: "fetch m3u8 failed",
                        headers: headers
                    });
                }
                
                var basePath = realUrl.substring(0, realUrl.lastIndexOf('/') + 1);
                var queryStr = realUrl.split('?')[1] || '';
                var lines = m3u8Content.split('\n');
                var newLines = [];
                
                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i].trim();
                    if (!line) continue;
                    
                    if (line.startsWith('#')) {
                        // 处理m3u8中的URL（有些m3u8会在#EXT-X-KEY等标签中包含URL）
                        if (line.indexOf('URI="') > -1) {
                            // 替换密钥URL等（如果需要）
                            newLines.push(line);
                        } else {
                            newLines.push(line);
                        }
                    } else {
                        // 处理TS或子M3U8链接
                        var fullUrl;
                        if (line.startsWith('http')) {
                            fullUrl = line;
                        } else {
                            fullUrl = basePath + line;
                        }
                        
                        // 保持查询参数
                        if (queryStr && fullUrl.indexOf('?') === -1) {
                            fullUrl = fullUrl + '?' + queryStr;
                        } else if (queryStr && fullUrl.indexOf('?') > -1) {
                            fullUrl = fullUrl + '&' + queryStr;
                        }
                        
                        // 构造代理链接（使用ts@标记）
                        var proxyPayload = 'ts@' + encodeURIComponent(fullUrl);
                        
                        // 重新构造本地代理URL（子M3U8或TS都走代理）
                        var headerStr = encodeURIComponent(JSON.stringify(headers));
                        var proxyLine = "http://127.0.0.1:9978/proxy?do=js&from=catvod&siteType=3&siteKey=hmys&header=" + headerStr + "&url=" + encodeURIComponent(encodeURIComponent(proxyPayload));
                        
                        newLines.push(proxyLine);
                    }
                }
                
                return JSON.stringify({
                    code: 200,
                    content: newLines.join('\n'),
                    headers: {
                        "Content-Type": "application/vnd.apple.mpegurl",
                        "User-Agent": headers['User-Agent'] || 'Mozi'
                    }
                });
            } catch(e) {
                log('proxy error: ' + e.message);
                return JSON.stringify({
                    code: 500,
                    content: e.message,
                    headers: headers
                });
            }
        }
    }
};

// 导出规则

$.exports = csdown;
