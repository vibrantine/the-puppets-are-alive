// Defines the happy emotion using the original v1 poses and timing.
// spark is the one-time entry reaction; idle and speaking are repeating sequences.
// Each checkpoint specifies arm, head and body destinations plus travel time.
// ExpressionPlayer owns the clock and blends between these poses for each puppet.
// Keeping this choreography here lets us tune one emotion independently.
// Happy expression: authored spark, idle and speaking destinations; playback owns all state.
// Arm offsets are degrees from each puppet's rest; head angles are local degrees.
// Body lean/sway are degrees; bob is stage units (negative up). Each moveSeconds
// sets arrival time from the preceding pose. Repeat identical poses for a hold.
const happyEmotion = {
    name: 'happy',
    // One-shot reaction on emotion entry; return to the emotion's resting pose.
    spark: {
        checkpoints: [
            {
                armOffsets: { left: 76, right: 70 },
                head: { nod: -10, tilt: -6 },
                bodyOffsets: { lean: 5, swayAngle: -4, bobOffset: -9 },
                moveSeconds: 0.18
            },
            {
                armOffsets: { left: 60, right: 76 },
                head: { nod: -3, tilt: 5 },
                bodyOffsets: { lean: 4, swayAngle: 4, bobOffset: -5 },
                moveSeconds: 0.18
            },
            {
                armOffsets: { left: 55, right: 40 },
                head: { nod: -5, tilt: -8 },
                bodyOffsets: { lean: 3, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.28
            }
        ]
    },
    idle: {
        repeatDelaySeconds: 0,
        checkpoints: [
            {
                armOffsets: { left: 59, right: 40 },
                head: { nod: -5, tilt: -11 },
                bodyOffsets: { lean: 3, swayAngle: 0, bobOffset: -5 },
                moveSeconds: 0.7
            },
            {
                armOffsets: { left: 59, right: 40 },
                head: { nod: -5, tilt: -11 },
                bodyOffsets: { lean: 3, swayAngle: 0, bobOffset: -5 },
                moveSeconds: 0.5
            },
            {
                armOffsets: { left: 55, right: 40 },
                head: { nod: -5, tilt: -8 },
                bodyOffsets: { lean: 3, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.8
            },
            {
                armOffsets: { left: 47, right: 43 },
                head: { nod: -5, tilt: -5 },
                bodyOffsets: { lean: 3, swayAngle: 0, bobOffset: 2 },
                moveSeconds: 0.8
            },
            {
                armOffsets: { left: 47, right: 43 },
                head: { nod: -5, tilt: -5 },
                bodyOffsets: { lean: 3, swayAngle: 0, bobOffset: 2 },
                moveSeconds: 0.5
            },
            {
                armOffsets: { left: 55, right: 40 },
                head: { nod: -5, tilt: -8 },
                bodyOffsets: { lean: 3, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.7
            }
        ]
    },
    speaking: {
        repeatDelaySeconds: 0,
        checkpoints: [
            {
                armOffsets: { left: 73, right: 4 },
                head: { nod: 1, tilt: -11 },
                bodyOffsets: { lean: 3, swayAngle: 0, bobOffset: -5 },
                moveSeconds: 0.5
            },
            {
                armOffsets: { left: 73, right: 4 },
                head: { nod: 1, tilt: -11 },
                bodyOffsets: { lean: 3, swayAngle: 0, bobOffset: -5 },
                moveSeconds: 0.5
            },
            {
                armOffsets: { left: 8, right: 72 },
                head: { nod: -7, tilt: 2 },
                bodyOffsets: { lean: 3, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.55
            },
            {
                armOffsets: { left: 8, right: 72 },
                head: { nod: -7, tilt: 2 },
                bodyOffsets: { lean: 3, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.5
            },
            {
                armOffsets: { left: 73, right: 72 },
                head: { nod: -8, tilt: -8 },
                bodyOffsets: { lean: 6, swayAngle: 0, bobOffset: -8 },
                moveSeconds: 0.6
            },
            {
                armOffsets: { left: 73, right: 72 },
                head: { nod: -8, tilt: -8 },
                bodyOffsets: { lean: 6, swayAngle: 0, bobOffset: -8 },
                moveSeconds: 0.7
            },
            {
                armOffsets: { left: 20, right: 16 },
                head: { nod: 0, tilt: -8 },
                bodyOffsets: { lean: 3, swayAngle: 0, bobOffset: 2 },
                moveSeconds: 0.65
            },
            {
                armOffsets: { left: 55, right: 40 },
                head: { nod: -5, tilt: -8 },
                bodyOffsets: { lean: 3, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.8
            }
        ]
    }
};
