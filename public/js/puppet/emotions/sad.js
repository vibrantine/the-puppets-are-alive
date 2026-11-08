// Defines the sad emotion using the original v1 poses and timing.
// spark is the one-time entry reaction; idle and speaking are repeating sequences.
// Each checkpoint specifies arm, head and body destinations plus travel time.
// ExpressionPlayer owns the clock and blends between these poses for each puppet.
// Keeping this choreography here lets us tune one emotion independently.
// Sad expression: authored spark, idle and speaking destinations; playback owns all state.
// Arm offsets are degrees from each puppet's rest; head angles are local degrees.
// Body lean/sway are degrees; bob is stage units (negative up). Each moveSeconds
// sets arrival time from the preceding pose. Repeat identical poses for a hold.
const sadEmotion = {
    name: 'sad',
    // One-shot reaction on emotion entry; return to the emotion's resting pose.
    spark: {
        checkpoints: [
            {
                armOffsets: { left: 2, right: 0 },
                head: { nod: 24, tilt: 8 },
                bodyOffsets: { lean: 10, swayAngle: 0, bobOffset: 14 },
                moveSeconds: 0.35
            },
            {
                armOffsets: { left: 0, right: 0 },
                head: { nod: 18, tilt: 8 },
                bodyOffsets: { lean: 8, swayAngle: 0, bobOffset: 10 },
                moveSeconds: 0.4
            }
        ]
    },
    idle: {
        repeatDelaySeconds: 0,
        checkpoints: [
            {
                armOffsets: { left: 0, right: 0 },
                head: { nod: 22, tilt: 10 },
                bodyOffsets: { lean: 8, swayAngle: 0, bobOffset: 12.6 },
                moveSeconds: 1.5
            },
            {
                armOffsets: { left: 0, right: 0 },
                head: { nod: 22, tilt: 10 },
                bodyOffsets: { lean: 8, swayAngle: 0, bobOffset: 12.6 },
                moveSeconds: 0.9
            },
            {
                armOffsets: { left: 0, right: 0 },
                head: { nod: 16, tilt: 7 },
                bodyOffsets: { lean: 8, swayAngle: 0, bobOffset: 9.4 },
                moveSeconds: 1.6
            },
            {
                armOffsets: { left: 0, right: 0 },
                head: { nod: 18, tilt: 8 },
                bodyOffsets: { lean: 8, swayAngle: 0, bobOffset: 10 },
                moveSeconds: 1.6
            }
        ]
    },
    speaking: {
        repeatDelaySeconds: 0,
        checkpoints: [
            {
                armOffsets: { left: 4, right: 36 },
                head: { nod: 10, tilt: 5 },
                bodyOffsets: { lean: 5, swayAngle: 0, bobOffset: 10 },
                moveSeconds: 1
            },
            {
                armOffsets: { left: 4, right: 36 },
                head: { nod: 10, tilt: 5 },
                bodyOffsets: { lean: 5, swayAngle: 0, bobOffset: 10 },
                moveSeconds: 1.2
            },
            {
                armOffsets: { left: 0, right: 8 },
                head: { nod: 22, tilt: 8 },
                bodyOffsets: { lean: 8, swayAngle: 0, bobOffset: 14 },
                moveSeconds: 0.9
            },
            {
                armOffsets: { left: 22, right: 0 },
                head: { nod: 15, tilt: 11 },
                bodyOffsets: { lean: 8, swayAngle: 0, bobOffset: 10 },
                moveSeconds: 1
            },
            {
                armOffsets: { left: 22, right: 0 },
                head: { nod: 15, tilt: 11 },
                bodyOffsets: { lean: 8, swayAngle: 0, bobOffset: 10 },
                moveSeconds: 0.9
            },
            {
                armOffsets: { left: 3, right: 0 },
                head: { nod: 22, tilt: 8 },
                bodyOffsets: { lean: 8, swayAngle: 0, bobOffset: 13 },
                moveSeconds: 0.8
            },
            {
                armOffsets: { left: 0, right: 0 },
                head: { nod: 18, tilt: 8 },
                bodyOffsets: { lean: 8, swayAngle: 0, bobOffset: 10 },
                moveSeconds: 1
            }
        ]
    }
};
