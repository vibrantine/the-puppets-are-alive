// Defines the angry emotion using the original v1 poses and timing.
// spark is the one-time entry reaction; idle and speaking are repeating sequences.
// Each checkpoint specifies arm, head and body destinations plus travel time.
// ExpressionPlayer owns the clock and blends between these poses for each puppet.
// Keeping this choreography here lets us tune one emotion independently.
// Angry expression: authored spark, idle and speaking destinations; playback owns all state.
// Arm offsets are degrees from each puppet's rest; head angles are local degrees.
// Body lean/sway are degrees; bob is stage units (negative up). Each moveSeconds
// sets arrival time from the preceding pose. Repeat identical poses for a hold.
const angryEmotion = {
    name: 'angry',
    // One-shot reaction on emotion entry; return to the emotion's resting pose.
    spark: {
        checkpoints: [
            {
                armOffsets: { left: 55, right: 45 },
                head: { nod: 16, tilt: -3 },
                bodyOffsets: { lean: 14, swayAngle: -2, bobOffset: -3 },
                moveSeconds: 0.14
            },
            {
                armOffsets: { left: 24, right: 32 },
                head: { nod: 6, tilt: 0 },
                bodyOffsets: { lean: 8, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.12
            },
            {
                armOffsets: { left: 32, right: 32 },
                head: { nod: 8, tilt: 0 },
                bodyOffsets: { lean: 10, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.2
            }
        ]
    },
    idle: {
        repeatDelaySeconds: 0,
        checkpoints: [
            {
                armOffsets: { left: 35, right: 29 },
                head: { nod: 10, tilt: 0 },
                bodyOffsets: { lean: 11, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.9
            },
            {
                armOffsets: { left: 35, right: 29 },
                head: { nod: 10, tilt: 0 },
                bodyOffsets: { lean: 11, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.6
            },
            {
                armOffsets: { left: 29, right: 35 },
                head: { nod: 8, tilt: -2 },
                bodyOffsets: { lean: 10, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 1.2
            },
            {
                armOffsets: { left: 32, right: 32 },
                head: { nod: 8, tilt: 0 },
                bodyOffsets: { lean: 10, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 1.1
            }
        ]
    },
    speaking: {
        repeatDelaySeconds: 0,
        checkpoints: [
            {
                armOffsets: { left: 4, right: 74 },
                head: { nod: 14, tilt: 0 },
                bodyOffsets: { lean: 13, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.4
            },
            {
                armOffsets: { left: 4, right: 74 },
                head: { nod: 14, tilt: 0 },
                bodyOffsets: { lean: 13, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.45
            },
            {
                armOffsets: { left: 6, right: 12 },
                head: { nod: 6, tilt: 0 },
                bodyOffsets: { lean: 10, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.35
            },
            {
                armOffsets: { left: 4, right: 74 },
                head: { nod: 13, tilt: 0 },
                bodyOffsets: { lean: 13, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.35
            },
            {
                armOffsets: { left: 4, right: 74 },
                head: { nod: 13, tilt: 0 },
                bodyOffsets: { lean: 13, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.4
            },
            {
                armOffsets: { left: 74, right: 4 },
                head: { nod: 8, tilt: -4 },
                bodyOffsets: { lean: 12, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.6
            },
            {
                armOffsets: { left: 74, right: 4 },
                head: { nod: 8, tilt: -4 },
                bodyOffsets: { lean: 12, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.55
            },
            {
                armOffsets: { left: 14, right: 14 },
                head: { nod: 11, tilt: 0 },
                bodyOffsets: { lean: 10, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.5
            },
            {
                armOffsets: { left: 32, right: 32 },
                head: { nod: 8, tilt: 0 },
                bodyOffsets: { lean: 10, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.8
            }
        ]
    }
};
