'use strict';

var test = require('tape');
var sinon = require('sinon');
var resizeCursor = require('resize-cursors');
var Store = require('../lib/store');
var helpers = require('../lib/helpers');
var createEl = require('./spec_util').createEl;
var getCursorState = helpers.getCursorState;

function cursorStyle(state) {
    state = state || {};
    return resizeCursor({
        top: state.onTopEdge,
        right: state.onRightEdge,
        bottom: state.onBottomEdge,
        left: state.onLeftEdge
    });
}

function getEnv() {
    return {
        window: { requestAnimationFrame: sinon.stub() },
        document: {
            addEventListener: sinon.stub(),
            removeEventListener: sinon.stub()
        }
    };
}

test('new store instance', function(t) {
    var env = getEnv();
    var subject = new Store(env);

    t.equal(subject.window, env.window);
    t.equal(subject.document, env.document);
    t.deepEqual(subject.resizers, [], 'has empty resizers list');
    t.equal(subject.shouldRedraw, false, 'initial shouldRedraw is false');
    t.end();
});

test('add resizer', function(t) {
    var subject = new Store(getEnv());
    var resizer = {};

    subject.add(resizer);

    t.deepEqual(subject.resizers, [resizer]);
    t.end();
});

test('remove resizer', function(t) {
    var subject = new Store(getEnv());
    var resizer = {};
    var resizerToRemove = {};
    var notAdded = {};

    subject.add(resizer);
    subject.add(resizerToRemove);
    subject.remove(resizerToRemove);
    subject.remove(notAdded);

    t.deepEqual(subject.resizers, [resizer]);
    t.end();
});

test('bind events', function(t) {
    var subject = new Store(getEnv());
    var doc = subject.document;

    subject.bindEvents();

    t.ok(doc.addEventListener.calledWith('mousemove', subject.onMove));
    t.ok(doc.addEventListener.calledWith('mouseup', subject.onUp));
    t.ok(doc.addEventListener.calledWith('touchmove', subject.onTouchMove));
    t.ok(doc.addEventListener.calledWith('touchend', subject.onTouchEnd));
    t.end();
});

test('unbind events', function(t) {
    var subject = new Store(getEnv());
    var doc = subject.document;

    subject.unbindEvents();

    t.ok(doc.removeEventListener.calledWith('mousemove', subject.onMove));
    t.ok(doc.removeEventListener.calledWith('mouseup', subject.onUp));
    t.ok(doc.removeEventListener.calledWith('touchmove', subject.onTouchMove));
    t.ok(doc.removeEventListener.calledWith('touchend', subject.onTouchEnd));
    t.end();
});

test('onMove', function(t) {
    var subject = new Store(getEnv());
    var e = { clientX: 10, clientY: 10 };
    var resizer1 = { threshold: 5,
                     el: createEl({ t: 10, l: 10 }) };
    var resizer2 = { threshold: 4,
                     el: createEl({ t: 400, l: 0 }) };

    var expectedState1 = getCursorState(
        e, resizer1.el.getBoundingClientRect(), resizer1.threshold);
    var expectedState2 = getCursorState(
        e, resizer2.el.getBoundingClientRect(), resizer2.threshold);

    subject.add(resizer1);
    subject.add(resizer2);
    subject.onMove(e);

    ['Top', 'Right', 'Bottom', 'Left'].forEach(function(side) {
        var prop = 'on' + side + 'Edge';
        t.equal(resizer1[prop], expectedState1[prop]);
        t.equal(resizer2[prop], expectedState2[prop]);
    });
    t.equal(subject.shouldRedraw, true, 'should trigger redraw');

    t.end();
});

test('onUp', function(t) {
    var subject = new Store(getEnv());
    var e = { clientX: 400, clientY: 400 };
    var resizer = { threshold: 5,
                    el: createEl({ t: 10, l: 10 }) };

    resizer.grab = {};

    subject.add(resizer);
    subject.onUp(e);

    ['x', 'y', 'onTopEdge', 'onRightEdge', 'onBottomEdge', 'onLeftEdge']
        .forEach(function(prop) {
            t.ok(resizer[prop] !== undefined);
        });
    t.equal(resizer.grab, null);

    t.end();
});

test('onTouchMove', function(t) {
    var subject = new Store(getEnv());
    var e = { touches: [{ clientX: 0, clientY: 10 }] };

    sinon.spy(subject, 'onMove');
    subject.onTouchMove(e);
    t.ok(subject.onMove.calledWith(e.touches[0]));
    t.end();
});

test('onTouchEnd', function(t) {
    var subject = new Store(getEnv());
    var e = { touches: [], changedTouches: [{ clientX: 0, clientY: 10 }] };

    sinon.spy(subject, 'onUp');
    subject.onTouchEnd(e);
    t.ok(subject.onUp.calledWith(e.changedTouches[0]));
    t.end();
});

test('render', function(t) {
    var subject = new Store(getEnv());
    var win = subject.window;
    var resizer = {
        el: {
            style: { cursor: '' }
        },
        onTopEdge: false,
        onRightEdge: false,
        onBottomEdge: false,
        onLeftEdge: false
    };

    subject.render();
    t.ok(win.requestAnimationFrame.calledWith(subject.render),
         'should redraw with rAF');

    subject.add(resizer);
    subject.render();
    t.equal(resizer.el.style.cursor, '',
            'should not apply styles when shouldRedraw is false');

    subject.shouldRedraw = true;
    resizer.grab = {
        onRightEdge: true
    };
    subject.render();
    t.equal(resizer.el.style.cursor, cursorStyle(resizer.grab),
            'should apply styles when shouldRedraw is true');
    t.equal(subject.shouldRender, false, 'redraw should reset shouldRedraw');

    t.end();
});
