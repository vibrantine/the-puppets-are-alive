// Defines the surprised emotion using the original v1 poses and timing.
// spark is the one-time entry reaction; idle and speaking are repeating sequences.
// Each checkpoint specifies arm, head and body destinations plus travel time.
// ExpressionPlayer owns the clock and blends between these poses for each puppet.
// Keeping this choreography here lets us tune one emotion independently.
// Surprised expression: authored spark, idle and speaking destinations; playback owns all state.
// Arm offsets are degrees from each puppet's rest; head angles are local degrees.
// Body lean/sway are degrees; bob is stage units (negative up). Each moveSeconds
// sets arrival time from the preceding pose. Repeat identical poses for a hold.
const surprisedEmotion = {
    name: 'surprised',
    // One-shot reaction on emotion entry; return to the emotion's resting pose.
    spark: {
        checkpoints: [
            {
                armOffsets: { left: 76, right: 76 },
                head: { nod: -24, tilt: 3 },
                bodyOffsets: { lean: -10, swayAngle: 0, bobOffset: -7 },
                moveSeconds: 0.12
            },
            {
                armOffsets: { left: 76, right: 76 },
                head: { nod: -18, tilt: 3 },
                bodyOffsets: { lean: -5, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.32
            }
        ]
    },
    // After the flinch, one hand lingers while the head listens for what comes next.
    idle: {
        repeatDelaySeconds: 0,
        checkpoints: [
            {
                armOffsets: { left: 24, right: 48 },
                head: { nod: -8, tilt: 5 },
                bodyOffsets: { lean: -3, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.75
            },
            {
                armOffsets: { left: 24, right: 48 },
                head: { nod: -8, tilt: 5 },
                bodyOffsets: { lean: -3, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 1.1
            },
            {
                armOffsets: { left: 19, right: 43 },
                head: { nod: -4, tilt: 8 },
                bodyOffsets: { lean: 1, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 1.1
            },
            {
                armOffsets: { left: 19, right: 43 },
                head: { nod: -7, tilt: 6 },
                bodyOffsets: { lean: -5, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 1.6
            }
        ]
    },
    speaking: {
        repeatDelaySeconds: 0,
        checkpoints: [
            {
                armOffsets: { left: 12, right: 12 },
                head: { nod: -6, tilt: 3 },
                bodyOffsets: { lean: 1, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.65
            },
            {
                armOffsets: { left: 12, right: 12 },
                head: { nod: -6, tilt: 3 },
                bodyOffsets: { lean: 1, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.6
            },
            {
                armOffsets: { left: 76, right: 76 },
                head: { nod: -21, tilt: 3 },
                bodyOffsets: { lean: -7, swayAngle: 0, bobOffset: -5 },
                moveSeconds: 0.6
            },
            {
                armOffsets: { left: 76, right: 76 },
                head: { nod: -21, tilt: 3 },
                bodyOffsets: { lean: -7, swayAngle: 0, bobOffset: -5 },
                moveSeconds: 0.8
            },
            {
                armOffsets: { left: 18, right: 68 },
                head: { nod: -10, tilt: 9 },
                bodyOffsets: { lean: -5, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.65
            },
            {
                armOffsets: { left: 66, right: 18 },
                head: { nod: -13, tilt: -3 },
                bodyOffsets: { lean: -5, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.65
            },
            {
                armOffsets: { left: 46, right: 46 },
                head: { nod: -8, tilt: 3 },
                bodyOffsets: { lean: -1, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 0.7
            },
            {
                armOffsets: { left: 76, right: 76 },
                head: { nod: -18, tilt: 3 },
                bodyOffsets: { lean: -5, swayAngle: 0, bobOffset: 0 },
                moveSeconds: 1.15
            }
        ]
    }
};
